"use client"

import {
	calculateSemanticSimilarity,
	getConnectionVisualProps,
	getMagicalConnectionColor,
} from "@/lib/similarity"
import { useMemo } from "react"
import { colors, LAYOUT_CONSTANTS, getDocumentTypeColor } from "@/constants"
import type {
	DocumentsResponse,
	DocumentWithMemories,
	GraphEdge,
	GraphNode,
	MemoryEntry,
	MemoryRelation,
} from "@/types"

export function useGraphData(
	data: DocumentsResponse | null,
	selectedSpace: string,
	nodePositions: Map<string, { x: number; y: number }>,
	draggingNodeId: string | null,
	memoryLimit?: number,
) {
	return useMemo(() => {
		if (!data?.documents) return { nodes: [], edges: [] }

		const allNodes: GraphNode[] = []
		const allEdges: GraphEdge[] = []

		// Filter documents that have memories in selected space
		// AND limit memories per document when memoryLimit is provided
		const filteredDocuments = data.documents
			.map((doc) => {
				let memories =
					selectedSpace === "all"
						? doc.memoryEntries
						: doc.memoryEntries.filter(
								(memory) =>
									(memory.spaceContainerTag ?? memory.spaceId ?? "default") ===
									selectedSpace,
							)

				// Apply memory limit if provided and a specific space is selected
				if (selectedSpace !== "all" && memoryLimit && memoryLimit > 0) {
					memories = memories.slice(0, memoryLimit)
				}

				return {
					...doc,
					memoryEntries: memories,
				}
			})

		// Group documents by space for better clustering
		const documentsBySpace = new Map<string, typeof filteredDocuments>()
		filteredDocuments.forEach((doc) => {
			const docSpace =
				doc.memoryEntries[0]?.spaceContainerTag ??
				doc.memoryEntries[0]?.spaceId ??
				"default"
			if (!documentsBySpace.has(docSpace)) {
				documentsBySpace.set(docSpace, [])
			}
			const spaceDocsArr = documentsBySpace.get(docSpace)
			if (spaceDocsArr) {
				spaceDocsArr.push(doc)
			}
		})

		// Grid-based isometric layout (single plane) - no overlaps
		const { centerX, centerY, clusterRadius } = LAYOUT_CONSTANTS
		
		// Grid parameters for isometric layout - increased spacing to prevent overlaps
		const docNodeSize = 80 // Document node size
		const memNodeSize = 40 // Memory node size
		const gridCellSize = 300 // Increased spacing between document grid cells to prevent overlaps
		const docsPerRow = Math.ceil(Math.sqrt(filteredDocuments.length)) // Square-ish grid
		
		// Memory grid spacing - increased to prevent overlaps
		const memGridSize = Math.max(80, memNodeSize * 2.5) // At least 2.5x node size for spacing

		/* 1. Build DOCUMENT nodes in grid layout */
		const documentNodes: GraphNode[] = []

		filteredDocuments.forEach((doc: DocumentWithMemories, docIndex: number) => {
			// Nodes are fixed in grid - no custom positions allowed
			// Calculate grid position
			const row = Math.floor(docIndex / docsPerRow)
			const col = docIndex % docsPerRow
			
			// Isometric grid positioning (staggered rows) - fixed positions for top-down view
			const isoOffset = row % 2 === 0 ? 0 : gridCellSize * 0.5 // Stagger alternate rows
			const defaultX = centerX + (col * gridCellSize) - (docsPerRow * gridCellSize * 0.5) + isoOffset
			const defaultY = centerY + (row * gridCellSize * 0.866) - (Math.ceil(filteredDocuments.length / docsPerRow) * gridCellSize * 0.433) // 0.866 = sin(60°) for 30° isometric

			documentNodes.push({
				id: doc.id,
				type: "document",
				x: defaultX,
				y: defaultY,
				data: doc,
				size: docNodeSize, // 2x larger than memory nodes (40)
				color: colors.document.primary,
				isHovered: false,
				isDragging: false, // Nodes are fixed, no dragging
			} satisfies GraphNode)
		})

		allNodes.push(...documentNodes)

		/* 3. Add memories around documents WITH doc-memory connections */
		documentNodes.forEach((docNode) => {
			const memoryNodeMap = new Map<string, GraphNode>()
			const doc = docNode.data as DocumentWithMemories

			doc.memoryEntries.forEach((memory, memIndex) => {
				const memoryId = `${memory.id}`

				// Arrange memories in a grid pattern around the document - no overlaps
				const memsPerRow = Math.ceil(Math.sqrt(doc.memoryEntries.length))
				const memRow = Math.floor(memIndex / memsPerRow)
				const memCol = memIndex % memsPerRow
				
				const memOffsetX = (memCol - (memsPerRow - 1) / 2) * memGridSize
				const memOffsetY = (memRow - (Math.ceil(doc.memoryEntries.length / memsPerRow) - 1) / 2) * memGridSize * 0.866 // 0.866 = sin(60°) for 30° isometric
				
				// Position memories below document with proper spacing
				const verticalOffset = docNodeSize / 2 + memNodeSize / 2 + 60 // Space between doc and memories
				const defaultMemX = docNode.x + memOffsetX
				const defaultMemY = docNode.y + memOffsetY + verticalOffset

				if (!memoryNodeMap.has(memoryId)) {
					// Get color based on parent document type
					const docTypeColor = getDocumentTypeColor(doc.type)
					const memoryNode: GraphNode = {
						id: memoryId,
						type: "memory",
						x: defaultMemX, // Fixed grid position
						y: defaultMemY, // Fixed grid position
						data: memory,
						size: memNodeSize, // Standard size (documents are 2x = 80)
						color: docTypeColor, // Color based on document type
						isHovered: false,
						isDragging: false, // Nodes are fixed, no dragging
					}
					memoryNodeMap.set(memoryId, memoryNode)
					allNodes.push(memoryNode)
				}

				// Create doc-memory edge with similarity
				allEdges.push({
					id: `edge-${docNode.id}-${memory.id}`,
					source: docNode.id,
					target: memoryId,
					similarity: 1,
					visualProps: getConnectionVisualProps(1),
					color: colors.connection.memory,
					edgeType: "doc-memory",
				})
			})
		})

		// Build mapping of memoryId -> nodeId for version chains
		const memNodeIdMap = new Map<string, string>()
		allNodes.forEach((n) => {
			if (n.type === "memory") {
				memNodeIdMap.set((n.data as MemoryEntry).id, n.id)
			}
		})

		// Add version-chain edges (old -> new)
		data.documents.forEach((doc) => {
			doc.memoryEntries.forEach((mem: MemoryEntry) => {
				// Support both new object structure and legacy array/single parent fields
				let parentRelations: Record<string, MemoryRelation> = {}

				if (
					mem.memoryRelations &&
					Array.isArray(mem.memoryRelations) &&
					mem.memoryRelations.length > 0
				) {
					// Convert array to Record
					parentRelations = mem.memoryRelations.reduce(
						(acc, rel) => {
							acc[rel.targetMemoryId] = rel.relationType
							return acc
						},
						{} as Record<string, MemoryRelation>,
					)
				} else if (mem.parentMemoryId) {
					parentRelations = {
						[mem.parentMemoryId]: "updates" as MemoryRelation,
					}
				}
				Object.entries(parentRelations).forEach(([pid, relationType]) => {
					const fromId = memNodeIdMap.get(pid)
					const toId = memNodeIdMap.get(mem.id)
					if (fromId && toId) {
						allEdges.push({
							id: `version-${fromId}-${toId}`,
							source: fromId,
							target: toId,
							similarity: 1,
							visualProps: {
								opacity: 0.8,
								thickness: 1,
								glow: 0,
								pulseDuration: 3000,
							},
							// choose color based on relation type
							color: colors.relations[relationType] ?? colors.relations.updates,
							edgeType: "version",
							relationType: relationType as MemoryRelation,
						})
					}
				})
			})
		})

		// Document-to-document similarity edges
		for (let i = 0; i < filteredDocuments.length; i++) {
			const docI = filteredDocuments[i]
			if (!docI) continue

			for (let j = i + 1; j < filteredDocuments.length; j++) {
				const docJ = filteredDocuments[j]
				if (!docJ) continue

				const sim = calculateSemanticSimilarity(
					docI.summaryEmbedding ? Array.from(docI.summaryEmbedding) : null,
					docJ.summaryEmbedding ? Array.from(docJ.summaryEmbedding) : null,
				)
				if (sim > 0.725) {
					allEdges.push({
						id: `doc-doc-${docI.id}-${docJ.id}`,
						source: docI.id,
						target: docJ.id,
						similarity: sim,
						visualProps: getConnectionVisualProps(sim),
						color: getMagicalConnectionColor(sim, 200),
						edgeType: "doc-doc",
					})
				}
			}
		}

		return { nodes: allNodes, edges: allEdges }
	}, [data, selectedSpace, nodePositions, draggingNodeId, memoryLimit])
}
