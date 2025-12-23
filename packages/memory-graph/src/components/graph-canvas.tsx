"use client"

import {
	memo,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
} from "react"
import { colors } from "@/constants"
import type {
	DocumentWithMemories,
	GraphCanvasProps,
	GraphNode,
	MemoryEntry,
} from "@/types"
import { canvasWrapper } from "./canvas-common.css"

export const GraphCanvas = memo<GraphCanvasProps>(
	({
		nodes,
		edges,
		panX,
		panY,
		zoom,
		width,
		height,
		onNodeHover,
		onNodeClick,
		onNodeDragStart,
		onNodeDragMove,
		onNodeDragEnd,
		onPanStart,
		onPanMove,
		onPanEnd,
		onWheel,
		onDoubleClick,
		onTouchStart,
		onTouchMove,
		onTouchEnd,
		draggingNodeId,
		highlightDocumentIds,
		selectedNodeId,
	}) => {
		const canvasRef = useRef<HTMLCanvasElement>(null)
		const animationRef = useRef<number>(0)
		const startTimeRef = useRef<number>(Date.now())
		const mousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
		const currentHoveredNode = useRef<string | null>(null)

		// Initialize start time once
		useEffect(() => {
			startTimeRef.current = Date.now()
		}, [])

		// Efficient hit detection
		const getNodeAtPosition = useCallback(
			(x: number, y: number): string | null => {
				// Check from top-most to bottom-most: memory nodes are drawn after documents
				for (let i = nodes.length - 1; i >= 0; i--) {
					const node = nodes[i]!
					const screenX = node.x * zoom + panX
					const screenY = node.y * zoom + panY
					const nodeSize = node.size * zoom

					const dx = x - screenX
					const dy = y - screenY
					const distance = Math.sqrt(dx * dx + dy * dy)

					if (distance <= nodeSize / 2) {
						return node.id
					}
				}
				return null
			},
			[nodes, panX, panY, zoom],
		)

		// Handle mouse events
		const handleMouseMove = useCallback(
			(e: React.MouseEvent) => {
				const canvas = canvasRef.current
				if (!canvas) return

				const rect = canvas.getBoundingClientRect()
				const x = e.clientX - rect.left
				const y = e.clientY - rect.top

				mousePos.current = { x, y }

				const nodeId = getNodeAtPosition(x, y)
				if (nodeId !== currentHoveredNode.current) {
					currentHoveredNode.current = nodeId
					onNodeHover(nodeId)
				}

				// Handle node dragging
				if (draggingNodeId) {
					onNodeDragMove(e)
				}
			},
			[getNodeAtPosition, onNodeHover, draggingNodeId, onNodeDragMove],
		)

		const handleMouseDown = useCallback(
			(e: React.MouseEvent) => {
				const canvas = canvasRef.current
				if (!canvas) return

				const rect = canvas.getBoundingClientRect()
				const x = e.clientX - rect.left
				const y = e.clientY - rect.top

				const nodeId = getNodeAtPosition(x, y)
				// Nodes are fixed - no dragging allowed, just panning
				onPanStart(e)
			},
			[getNodeAtPosition, onPanStart],
		)

		const handleClick = useCallback(
			(e: React.MouseEvent) => {
				const canvas = canvasRef.current
				if (!canvas) return

				const rect = canvas.getBoundingClientRect()
				const x = e.clientX - rect.left
				const y = e.clientY - rect.top

				const nodeId = getNodeAtPosition(x, y)
				if (nodeId) {
					onNodeClick(nodeId)
				}
			},
			[getNodeAtPosition, onNodeClick],
		)

		// Professional rendering function with LOD
		const render = useCallback(() => {
			const canvas = canvasRef.current
			if (!canvas) return

			const ctx = canvas.getContext("2d")
			if (!ctx) return

			const currentTime = Date.now()
			const _elapsed = currentTime - startTimeRef.current

			// Level-of-detail optimization based on zoom
			const useSimplifiedRendering = zoom < 0.3

			// Clear canvas
			ctx.clearRect(0, 0, width, height)

			// Set high quality rendering
			ctx.imageSmoothingEnabled = true
			ctx.imageSmoothingQuality = "high"

			// Draw isometric background grid (dark mode with subtle pattern)
			ctx.strokeStyle = "rgba(148, 163, 184, 0.06)" // Subtle isometric grid
			ctx.lineWidth = 0.5
			const gridSpacing = 120 * zoom
			const offsetX = panX % gridSpacing
			const offsetY = panY % gridSpacing

			// Isometric grid pattern (30-degree angle for isometric projection)
			const isoAngle = Math.PI / 6 // 30 degrees
			const cos30 = Math.cos(isoAngle)
			const sin30 = Math.sin(isoAngle)

			// Draw isometric diamond grid pattern
			for (let i = -20; i < width / gridSpacing + 20; i++) {
				const baseX = i * gridSpacing + offsetX
				
				// Diagonal lines going up-right (isometric)
				ctx.beginPath()
				ctx.moveTo(baseX, 0)
				ctx.lineTo(baseX + width * cos30, height)
				ctx.stroke()
				
				// Diagonal lines going up-left (isometric)
				ctx.beginPath()
				ctx.moveTo(baseX, 0)
				ctx.lineTo(baseX - width * cos30, height)
				ctx.stroke()
			}
			
			// Horizontal-ish lines for isometric grid
			for (let i = -20; i < height / gridSpacing + 20; i++) {
				const baseY = i * gridSpacing + offsetY
				ctx.beginPath()
				ctx.moveTo(0, baseY)
				ctx.lineTo(width, baseY)
				ctx.stroke()
			}

			// Create node lookup map
			const nodeMap = new Map(nodes.map((node) => [node.id, node]))

			// Determine if edges should be visible
			// Edges are COMPLETELY HIDDEN when zoomed out
			// Edges are visible when:
			// 1. A document is selected (selectedNodeId is a document), OR
			// 2. Zoom is high enough (zoomed in > 0.6)
			const isDocumentSelected =
				selectedNodeId !== null &&
				selectedNodeId !== undefined &&
				nodes.find((n) => n.id === selectedNodeId)?.type === "document"
			const isZoomedIn = zoom > 0.6
			const shouldShowEdges = isDocumentSelected || isZoomedIn

			// Draw enhanced edges with sophisticated styling (only if shouldShowEdges)
			ctx.lineCap = "round"
			if (shouldShowEdges) {
			edges.forEach((edge) => {
				const sourceNode = nodeMap.get(edge.source)
				const targetNode = nodeMap.get(edge.target)

				if (sourceNode && targetNode) {
					const sourceX = sourceNode.x * zoom + panX
					const sourceY = sourceNode.y * zoom + panY
					const targetX = targetNode.x * zoom + panX
					const targetY = targetNode.y * zoom + panY

					// Enhanced viewport culling with edge type considerations
					if (
						sourceX < -100 ||
						sourceX > width + 100 ||
						targetX < -100 ||
						targetX > width + 100
					) {
						return
					}

					// Skip very weak connections when zoomed out for performance
					if (useSimplifiedRendering) {
						if (
							edge.edgeType === "doc-memory" &&
							edge.visualProps.opacity < 0.3
						) {
							return // Skip very weak doc-memory edges when zoomed out
						}
					}

					// Enhanced connection styling based on edge type
					let connectionColor = colors.connection.weak
					let dashPattern: number[] = []
					let opacity = edge.visualProps.opacity
					let lineWidth = Math.max(1, edge.visualProps.thickness * zoom)

					if (edge.edgeType === "doc-memory") {
						// Doc-memory: Solid thin lines, subtle
						dashPattern = []
						connectionColor = colors.connection.memory
						opacity = 0.9
						lineWidth = 1
					} else if (edge.edgeType === "doc-doc") {
						// Doc-doc: Thick dashed lines with strong similarity emphasis
						dashPattern = useSimplifiedRendering ? [] : [10, 5] // Solid lines when zoomed out
						opacity = Math.max(0, edge.similarity * 0.5)
						lineWidth = Math.max(1, edge.similarity * 2) // Thicker for stronger similarity

						if (edge.similarity > 0.85)
							connectionColor = colors.connection.strong
						else if (edge.similarity > 0.725)
							connectionColor = colors.connection.medium
					} else if (edge.edgeType === "version") {
						// Version chains: Double line effect with relation-specific colors
						dashPattern = []
						connectionColor = edge.color || colors.relations.updates
						opacity = 0.8
						lineWidth = 2
					}

					ctx.strokeStyle = connectionColor
					ctx.lineWidth = lineWidth
					ctx.globalAlpha = opacity
					ctx.setLineDash(dashPattern)

					if (edge.edgeType === "version") {
						// Special double-line rendering for version chains
						// First line (outer)
						ctx.lineWidth = 3
						ctx.globalAlpha = opacity * 0.3
						ctx.beginPath()
						ctx.moveTo(sourceX, sourceY)
						ctx.lineTo(targetX, targetY)
						ctx.stroke()

						// Second line (inner)
						ctx.lineWidth = 1
						ctx.globalAlpha = opacity
						ctx.beginPath()
						ctx.moveTo(sourceX, sourceY)
						ctx.lineTo(targetX, targetY)
						ctx.stroke()
					} else {
						// Simplified lines when zoomed out, curved when zoomed in
						if (useSimplifiedRendering) {
							// Straight lines for performance
							ctx.beginPath()
							ctx.moveTo(sourceX, sourceY)
							ctx.lineTo(targetX, targetY)
							ctx.stroke()
						} else {
							// Regular curved line for doc-memory and doc-doc
							const midX = (sourceX + targetX) / 2
							const midY = (sourceY + targetY) / 2
							const dx = targetX - sourceX
							const dy = targetY - sourceY
							const distance = Math.sqrt(dx * dx + dy * dy)
							const controlOffset =
								edge.edgeType === "doc-memory"
									? 15
									: Math.min(30, distance * 0.2)

							ctx.beginPath()
							ctx.moveTo(sourceX, sourceY)
							ctx.quadraticCurveTo(
								midX + controlOffset * (dy / distance),
								midY - controlOffset * (dx / distance),
								targetX,
								targetY,
							)
							ctx.stroke()
						}
					}

					// Subtle arrow head for version edges
					if (edge.edgeType === "version") {
						const angle = Math.atan2(targetY - sourceY, targetX - sourceX)
						const arrowLength = Math.max(6, 8 * zoom) // Shorter, more subtle
						const arrowWidth = Math.max(8, 12 * zoom)

						// Calculate arrow position offset from node edge
						const nodeRadius = (targetNode.size * zoom) / 2
						const offsetDistance = nodeRadius + 2
						const arrowX = targetX - Math.cos(angle) * offsetDistance
						const arrowY = targetY - Math.sin(angle) * offsetDistance

						ctx.save()
						ctx.translate(arrowX, arrowY)
						ctx.rotate(angle)
						ctx.setLineDash([])

						// Simple outlined arrow (not filled)
						ctx.strokeStyle = connectionColor
						ctx.lineWidth = Math.max(1, 1.5 * zoom)
						ctx.globalAlpha = opacity

						ctx.beginPath()
						ctx.moveTo(0, 0)
						ctx.lineTo(-arrowLength, arrowWidth / 2)
						ctx.moveTo(0, 0)
						ctx.lineTo(-arrowLength, -arrowWidth / 2)
						ctx.stroke()

						ctx.restore()
					}
				}
			})
			}

			ctx.globalAlpha = 1
			ctx.setLineDash([])

			// Helper function to draw an isometric 3D cube matching the reference image
			const drawIsometricCube = (
				ctx: CanvasRenderingContext2D,
				x: number,
				y: number,
				size: number,
				baseColor: string,
				borderColor: string,
				glowColor: string,
				opacity: number = 1,
			) => {
				// Isometric projection constants - top-down view (shallow angle for top visibility)
				// Using a shallower angle (30 degrees) to show more of the top face
				const isoAngle = Math.PI / 6 // 30 degrees for top-down view
				const cos30 = Math.cos(isoAngle)
				const sin30 = Math.sin(isoAngle)

				// Cube dimensions - all nodes on same plane (no depth variation)
				const cubeSize = size * 0.8
				const depth = cubeSize * 0.3 // Reduced depth to show more top face

				// Calculate isometric offsets (same for all nodes) - top-down perspective
				const offsetX = depth * cos30
				const offsetY = depth * sin30

				// Top face (with blue glow) - all on same plane
				const topFace = [
					{ x: x - cubeSize / 2, y: y - cubeSize / 2 - offsetY },
					{ x: x + cubeSize / 2, y: y - cubeSize / 2 - offsetY },
					{ x: x + cubeSize / 2 + offsetX, y: y - cubeSize / 2 },
					{ x: x - cubeSize / 2 + offsetX, y: y - cubeSize / 2 },
				]

				// Right face
				const rightFace = [
					{ x: x + cubeSize / 2, y: y - cubeSize / 2 - offsetY },
					{ x: x + cubeSize / 2, y: y + cubeSize / 2 - offsetY },
					{ x: x + cubeSize / 2 + offsetX, y: y + cubeSize / 2 },
					{ x: x + cubeSize / 2 + offsetX, y: y - cubeSize / 2 },
				]

				// Front face
				const frontFace = [
					{ x: x - cubeSize / 2, y: y - cubeSize / 2 - offsetY },
					{ x: x + cubeSize / 2, y: y - cubeSize / 2 - offsetY },
					{ x: x + cubeSize / 2, y: y + cubeSize / 2 - offsetY },
					{ x: x - cubeSize / 2, y: y + cubeSize / 2 - offsetY },
				]

				ctx.save()
				ctx.globalAlpha = opacity

				// Draw cube body - dark grey/black (matching reference)
				const darkCubeColor = "rgba(30, 30, 30, 0.95)" // Dark grey, almost black
				
				// Draw right face (slightly darker)
				ctx.fillStyle = darkCubeColor
				ctx.beginPath()
				ctx.moveTo(rightFace[0]!.x, rightFace[0]!.y)
				rightFace.slice(1).forEach((point) => ctx.lineTo(point.x, point.y))
				ctx.closePath()
				ctx.fill()

				// Draw front face
				ctx.fillStyle = darkCubeColor
				ctx.beginPath()
				ctx.moveTo(frontFace[0]!.x, frontFace[0]!.y)
				frontFace.slice(1).forEach((point) => ctx.lineTo(point.x, point.y))
				ctx.closePath()
				ctx.fill()

				// Draw vibrant blue glow with soft halo effect on top face
				// Create gradient for the glow effect - top face is more prominent in top-down view
				const centerX = (topFace[0]!.x + topFace[1]!.x + topFace[2]!.x + topFace[3]!.x) / 4
				const centerY = (topFace[0]!.y + topFace[1]!.y + topFace[2]!.y + topFace[3]!.y) / 4
				const glowRadius = cubeSize * 0.85 // Larger glow radius for top-down view
				
				// Use vibrant blue for the glow (matching reference image)
				// Outer halo (soft, diffuse) - extends beyond top face edges
				const haloGradient = ctx.createRadialGradient(
					centerX, centerY, 0,
					centerX, centerY, glowRadius
				)
				haloGradient.addColorStop(0, "rgba(59, 130, 246, 0.9)") // Vibrant blue center
				haloGradient.addColorStop(0.3, "rgba(59, 130, 246, 0.7)") // Strong glow
				haloGradient.addColorStop(0.5, "rgba(59, 130, 246, 0.5)") // Medium glow
				haloGradient.addColorStop(0.7, "rgba(59, 130, 246, 0.3)") // Soft edge
				haloGradient.addColorStop(0.9, "rgba(59, 130, 246, 0.1)") // Very soft
				haloGradient.addColorStop(1, "rgba(59, 130, 246, 0)") // Fade to transparent
				
				ctx.fillStyle = haloGradient
				ctx.beginPath()
				ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2)
				ctx.fill()

				// Top face with vibrant blue (solid center) - matching reference
				ctx.fillStyle = "rgba(59, 130, 246, 0.95)" // Vibrant blue square
				ctx.beginPath()
				ctx.moveTo(topFace[0]!.x, topFace[0]!.y)
				topFace.slice(1).forEach((point) => ctx.lineTo(point.x, point.y))
				ctx.closePath()
				ctx.fill()

				// Draw clearly defined edges
				ctx.strokeStyle = "rgba(148, 163, 184, 0.4)" // Subtle edge color
				ctx.lineWidth = 1.5
				ctx.globalAlpha = opacity

				// Top face edges
				ctx.beginPath()
				ctx.moveTo(topFace[0]!.x, topFace[0]!.y)
				topFace.forEach((point) => ctx.lineTo(point.x, point.y))
				ctx.closePath()
				ctx.stroke()

				// Right face edges
				ctx.beginPath()
				ctx.moveTo(rightFace[0]!.x, rightFace[0]!.y)
				rightFace.forEach((point) => ctx.lineTo(point.x, point.y))
				ctx.closePath()
				ctx.stroke()

				// Front face edges
				ctx.beginPath()
				ctx.moveTo(frontFace[0]!.x, frontFace[0]!.y)
				frontFace.forEach((point) => ctx.lineTo(point.x, point.y))
				ctx.closePath()
				ctx.stroke()

				ctx.restore()
			}

			// Prepare highlight set from provided document IDs (customId or internal)
			const highlightSet = new Set<string>(highlightDocumentIds ?? [])

			// Draw nodes with enhanced styling and LOD optimization
			nodes.forEach((node) => {
				const screenX = node.x * zoom + panX
				const screenY = node.y * zoom + panY
				const nodeSize = node.size * zoom

				// Enhanced viewport culling
				const margin = nodeSize + 50
				if (
					screenX < -margin ||
					screenX > width + margin ||
					screenY < -margin ||
					screenY > height + margin
				) {
					return
				}

				const isHovered = currentHoveredNode.current === node.id
				const isDragging = node.isDragging
				const isHighlightedDocument = (() => {
					if (node.type !== "document" || highlightSet.size === 0) return false
					const doc = node.data as DocumentWithMemories
					if (doc.customId && highlightSet.has(doc.customId)) return true
					return highlightSet.has(doc.id)
				})()

				if (node.type === "document") {
					// Determine colors based on state
					let baseColor = isDragging
						? "rgba(148, 163, 184, 0.15)"
						: isHovered
							? "rgba(148, 163, 184, 0.12)"
							: "rgba(148, 163, 184, 0.08)"
					let borderColor = isDragging
						? "rgba(148, 163, 184, 0.4)"
						: isHovered
							? "rgba(148, 163, 184, 0.3)"
							: "rgba(148, 163, 184, 0.2)"
					let glowColor = isDragging
						? "rgba(59, 130, 246, 0.8)"
						: isHovered
							? "rgba(59, 130, 246, 0.6)"
							: "rgba(59, 130, 246, 0.4)"

					// Draw isometric cube for document nodes
					if (useSimplifiedRendering) {
						// Simple square when zoomed out
						const size = nodeSize * 0.8
						ctx.fillStyle = baseColor
						ctx.globalAlpha = 1
						ctx.strokeStyle = borderColor
						ctx.lineWidth = 1
						ctx.beginPath()
						ctx.rect(screenX - size / 2, screenY - size / 2, size, size)
						ctx.fill()
						ctx.stroke()
					} else {
						drawIsometricCube(
							ctx,
							screenX,
							screenY,
							nodeSize,
							baseColor,
							borderColor,
							glowColor,
							1,
						)
					}

					// Highlight ring for search hits
					if (isHighlightedDocument) {
						ctx.save()
						ctx.globalAlpha = 0.9
						ctx.strokeStyle = colors.accent.primary
						ctx.lineWidth = 3
						ctx.setLineDash([6, 4])
						const ringSize = nodeSize * 0.5
						ctx.beginPath()
						ctx.arc(screenX, screenY, ringSize, 0, 2 * Math.PI)
						ctx.stroke()
						ctx.setLineDash([])
						ctx.restore()
					}
				} else {
					// Enhanced memory styling with status indicators
					const mem = node.data as MemoryEntry
					const isForgotten =
						mem.isForgotten ||
						(mem.forgetAfter &&
							new Date(mem.forgetAfter).getTime() < Date.now())
					const isLatest = mem.isLatest

					// Check if memory is expiring soon (within 7 days)
					const expiringSoon =
						mem.forgetAfter &&
						!isForgotten &&
						new Date(mem.forgetAfter).getTime() - Date.now() <
							1000 * 60 * 60 * 24 * 7

					// Check if memory is new (created within last 24 hours)
					const isNew =
						!isForgotten &&
						new Date(mem.createdAt).getTime() > Date.now() - 1000 * 60 * 60 * 24

					// Determine colors based on status
					let baseColor = "rgba(148, 163, 184, 0.08)"
					let borderColor = "rgba(148, 163, 184, 0.2)"
					let glowColor = "rgba(59, 130, 246, 0.4)"

					if (isForgotten) {
						baseColor = colors.status.forgotten
						borderColor = "rgba(220,38,38,0.3)"
						glowColor = "rgba(220,38,38,0.2)"
					} else if (expiringSoon) {
						borderColor = colors.status.expiring
						glowColor = colors.accent.amber
					} else if (isNew) {
						borderColor = colors.status.new
						glowColor = colors.accent.emerald
					}

					if (isDragging) {
						baseColor = "rgba(148, 163, 184, 0.15)"
						borderColor = glowColor
					} else if (isHovered) {
						baseColor = "rgba(148, 163, 184, 0.12)"
						glowColor = "rgba(59, 130, 246, 0.6)"
					}

					const opacity = isLatest ? 1 : 0.4

					if (useSimplifiedRendering) {
						// Simple circles when zoomed out for performance
						const radius = nodeSize / 2
						ctx.fillStyle = baseColor
						ctx.globalAlpha = opacity
						ctx.strokeStyle = borderColor
						ctx.lineWidth = isDragging ? 3 : isHovered ? 2 : 1.5
						ctx.beginPath()
						ctx.arc(screenX, screenY, radius, 0, 2 * Math.PI)
						ctx.fill()
						ctx.stroke()
					} else {
						// Draw isometric cube for memory nodes
						drawIsometricCube(
							ctx,
							screenX,
							screenY,
							nodeSize,
							baseColor,
							borderColor,
							glowColor,
							opacity,
						)
					}

					// Status indicators overlay (always preserve these as required)
					if (isForgotten) {
						// Cross for forgotten memories
						ctx.strokeStyle = "rgba(220,38,38,0.4)"
						ctx.lineWidth = 2
						const r = nodeSize * 0.25
						ctx.beginPath()
						ctx.moveTo(screenX - r, screenY - r)
						ctx.lineTo(screenX + r, screenY + r)
						ctx.moveTo(screenX + r, screenY - r)
						ctx.lineTo(screenX - r, screenY + r)
						ctx.stroke()
					} else if (isNew) {
						// Small dot for new memories
						ctx.fillStyle = colors.status.new
						ctx.beginPath()
						ctx.arc(
							screenX + nodeSize * 0.25,
							screenY - nodeSize * 0.25,
							Math.max(2, nodeSize * 0.15), // Scale with node size, minimum 2px
							0,
							2 * Math.PI,
						)
						ctx.fill()
					}
				}

				// Enhanced hover glow effect (skip when zoomed out for performance)
				if (!useSimplifiedRendering && (isHovered || isDragging)) {
					const glowColor = "rgba(59, 130, 246, 0.4)"

					ctx.strokeStyle = glowColor
					ctx.lineWidth = 2
					ctx.globalAlpha = 0.6

					// Circular glow around the cube
					ctx.beginPath()
					const glowRadius = nodeSize * 0.6
					ctx.arc(screenX, screenY, glowRadius, 0, 2 * Math.PI)
					ctx.stroke()
				}

				// Draw document labels with pin when zoomed out
				if (node.type === "document" && zoom < 0.5) {
					const doc = node.data as DocumentWithMemories
					const labelY = screenY - nodeSize / 2 - 25 // Position above the node
					const pinEndY = screenY - nodeSize / 2 // End of pin at top of node

					// Draw pin line
					ctx.strokeStyle = "rgba(148, 163, 184, 0.4)"
					ctx.lineWidth = 1
					ctx.globalAlpha = 0.6
					ctx.beginPath()
					ctx.moveTo(screenX, pinEndY)
					ctx.lineTo(screenX, labelY)
					ctx.stroke()

					// Draw label background
					const labelText = doc.title || doc.type || "Document"
					const maxLabelWidth = 120
					ctx.font = `${12 * zoom}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
					const textMetrics = ctx.measureText(labelText)
					const labelWidth = Math.min(textMetrics.width + 16, maxLabelWidth)
					const labelHeight = 20

					ctx.fillStyle = "rgba(15, 20, 25, 0.9)" // Dark background
					ctx.strokeStyle = "rgba(148, 163, 184, 0.3)"
					ctx.lineWidth = 1
					ctx.globalAlpha = 0.9
					ctx.beginPath()
						ctx.roundRect(
						screenX - labelWidth / 2,
						labelY - labelHeight / 2,
						labelWidth,
						labelHeight,
						4,
					)
					ctx.fill()
					ctx.stroke()

					// Draw document type icon (simple shape)
					const iconSize = 10
					const iconX = screenX - labelWidth / 2 + 6
					const iconY = labelY
					ctx.fillStyle = "rgba(148, 163, 184, 0.8)"
					ctx.globalAlpha = 1
					// Simple document icon (rectangle)
					ctx.fillRect(iconX - iconSize / 2, iconY - iconSize / 2, iconSize, iconSize)

					// Draw text
					ctx.fillStyle = "rgba(255, 255, 255, 0.9)"
					ctx.textAlign = "left"
					ctx.textBaseline = "middle"
					const textX = screenX - labelWidth / 2 + 18
					const truncatedText =
						textMetrics.width > maxLabelWidth - 24
							? labelText.substring(0, Math.floor((maxLabelWidth - 24) / (textMetrics.width / labelText.length))) + "..."
							: labelText
					ctx.fillText(truncatedText, textX, labelY)
				}
			})

			ctx.globalAlpha = 1
		}, [nodes, edges, panX, panY, zoom, width, height, highlightDocumentIds, selectedNodeId])

		// Change-based rendering instead of continuous animation
		const lastRenderParams = useRef<string>("")

		// Create a render key that changes when visual state changes
		const renderKey = useMemo(() => {
			const nodePositions = nodes
				.map(
					(n) =>
						`${n.id}:${n.x}:${n.y}:${n.isDragging ? "1" : "0"}:${currentHoveredNode.current === n.id ? "1" : "0"}`,
				)
				.join("|")
			const highlightKey = (highlightDocumentIds ?? []).join("|")
			return `${nodePositions}-${edges.length}-${panX}-${panY}-${zoom}-${width}-${height}-${highlightKey}-${selectedNodeId ?? ""}`
		}, [
			nodes,
			edges.length,
			panX,
			panY,
			zoom,
			width,
			height,
			highlightDocumentIds,
		])

		// Only render when something actually changed
		useEffect(() => {
			if (renderKey !== lastRenderParams.current) {
				lastRenderParams.current = renderKey
				render()
			}
		}, [renderKey, render])

		// Cleanup any existing animation frames
		useEffect(() => {
			return () => {
				if (animationRef.current) {
					cancelAnimationFrame(animationRef.current)
				}
			}
		}, [])

		// Add native wheel event listener to prevent browser zoom
		useEffect(() => {
			const canvas = canvasRef.current
			if (!canvas) return

			const handleNativeWheel = (e: WheelEvent) => {
				e.preventDefault()
				e.stopPropagation()

				// Call the onWheel handler with a synthetic-like event
				// @ts-expect-error - partial WheelEvent object
				onWheel({
					deltaY: e.deltaY,
					deltaX: e.deltaX,
					clientX: e.clientX,
					clientY: e.clientY,
					currentTarget: canvas,
					nativeEvent: e,
					preventDefault: () => {},
					stopPropagation: () => {},
				} as React.WheelEvent)
			}

			// Add listener with passive: false to ensure preventDefault works
			canvas.addEventListener("wheel", handleNativeWheel, { passive: false })

			// Also prevent gesture events for touch devices
			const handleGesture = (e: Event) => {
				e.preventDefault()
			}

			canvas.addEventListener("gesturestart", handleGesture, {
				passive: false,
			})
			canvas.addEventListener("gesturechange", handleGesture, {
				passive: false,
			})
			canvas.addEventListener("gestureend", handleGesture, { passive: false })

			return () => {
				canvas.removeEventListener("wheel", handleNativeWheel)
				canvas.removeEventListener("gesturestart", handleGesture)
				canvas.removeEventListener("gesturechange", handleGesture)
				canvas.removeEventListener("gestureend", handleGesture)
			}
		}, [onWheel])

		//  High-DPI handling  --------------------------------------------------
		const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1

		useLayoutEffect(() => {
			const canvas = canvasRef.current
			if (!canvas) return

			// upscale backing store
			canvas.style.width = `${width}px`
			canvas.style.height = `${height}px`
			canvas.width = width * dpr
			canvas.height = height * dpr

			const ctx = canvas.getContext("2d")
			ctx?.scale(dpr, dpr)
		}, [width, height, dpr])
		// -----------------------------------------------------------------------

		return (
			<canvas
				className={canvasWrapper}
				height={height}
				onClick={handleClick}
				onDoubleClick={onDoubleClick}
				onMouseDown={handleMouseDown}
				onMouseLeave={() => {
					if (draggingNodeId) {
						onNodeDragEnd()
					} else {
						onPanEnd()
					}
				}}
				onMouseMove={(e) => {
					handleMouseMove(e)
					if (!draggingNodeId) {
						onPanMove(e)
					}
				}}
				onMouseUp={() => {
					if (draggingNodeId) {
						onNodeDragEnd()
					} else {
						onPanEnd()
					}
				}}
				onTouchStart={onTouchStart}
				onTouchMove={onTouchMove}
				onTouchEnd={onTouchEnd}
				ref={canvasRef}
				style={{
					cursor: draggingNodeId
						? "grabbing"
						: currentHoveredNode.current
							? "grab"
							: "move",
					touchAction: "none",
					userSelect: "none",
					WebkitUserSelect: "none",
				}}
				width={width}
			/>
		)
	},
)

GraphCanvas.displayName = "GraphCanvas"
