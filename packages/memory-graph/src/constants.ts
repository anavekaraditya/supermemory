// Enhanced glass-morphism color palette
export const colors = {
	background: {
		primary: "#0f1419", // Deep dark blue-gray
		secondary: "#1a1f29", // Slightly lighter
		accent: "#252a35", // Card backgrounds
	},
	document: {
		primary: "rgba(255, 255, 255, 0.06)", // Subtle glass white
		secondary: "rgba(255, 255, 255, 0.12)", // More visible
		accent: "rgba(255, 255, 255, 0.18)", // Hover state
		border: "rgba(255, 255, 255, 0.25)", // Sharp borders
		glow: "rgba(147, 197, 253, 0.4)", // Blue glow for interaction
	},
	memory: {
		primary: "rgba(147, 197, 253, 0.08)", // Subtle glass blue
		secondary: "rgba(147, 197, 253, 0.16)", // More visible
		accent: "rgba(147, 197, 253, 0.24)", // Hover state
		border: "rgba(147, 197, 253, 0.35)", // Sharp borders
		glow: "rgba(147, 197, 253, 0.5)", // Blue glow for interaction
	},
	connection: {
		weak: "rgba(148, 163, 184, 0)", // Very subtle
		memory: "rgba(148, 163, 184, 0.3)", // Very subtle
		medium: "rgba(148, 163, 184, 0.125)", // Medium visibility
		strong: "rgba(148, 163, 184, 0.4)", // Strong connection
	},
	text: {
		primary: "#ffffff", // Pure white
		secondary: "#e2e8f0", // Light gray
		muted: "#94a3b8", // Medium gray
	},
	accent: {
		primary: "rgba(59, 130, 246, 0.7)", // Clean blue
		secondary: "rgba(99, 102, 241, 0.6)", // Clean purple
		glow: "rgba(147, 197, 253, 0.6)", // Subtle glow
		amber: "rgba(251, 165, 36, 0.8)", // Amber for expiring
		emerald: "rgba(16, 185, 129, 0.4)", // Emerald for new
	},
	status: {
		forgotten: "rgba(220, 38, 38, 0.15)", // Red for forgotten
		expiring: "rgba(251, 165, 36, 0.8)", // Amber for expiring soon
		new: "rgba(16, 185, 129, 0.4)", // Emerald for new memories
	},
	relations: {
		updates: "rgba(147, 77, 253, 0.5)", // purple
		extends: "rgba(16, 185, 129, 0.5)", // green
		derives: "rgba(147, 197, 253, 0.5)", // blue
	},
}

// Document type to color mapping for memory nodes
export const documentTypeColors: Record<string, string> = {
	// Google
	google_doc: "rgba(66, 133, 244, 0.4)", // Google Blue
	google_sheet: "rgba(16, 185, 129, 0.4)", // Google Green
	google_slide: "rgba(251, 188, 4, 0.4)", // Google Yellow
	google_drive: "rgba(66, 133, 244, 0.4)", // Google Blue
	
	// Microsoft
	word: "rgba(43, 87, 154, 0.4)", // Microsoft Word Blue
	microsoft_word: "rgba(43, 87, 154, 0.4)",
	excel: "rgba(16, 124, 16, 0.4)", // Microsoft Excel Green
	microsoft_excel: "rgba(16, 124, 16, 0.4)",
	powerpoint: "rgba(210, 71, 38, 0.4)", // Microsoft PowerPoint Orange
	microsoft_powerpoint: "rgba(210, 71, 38, 0.4)",
	onenote: "rgba(114, 83, 178, 0.4)", // Microsoft OneNote Purple
	microsoft_onenote: "rgba(114, 83, 178, 0.4)",
	onedrive: "rgba(0, 120, 212, 0.4)", // Microsoft OneDrive Blue
	
	// Other
	notion: "rgba(0, 0, 0, 0.4)", // Notion Black
	notion_doc: "rgba(0, 0, 0, 0.4)",
	pdf: "rgba(220, 38, 38, 0.4)", // PDF Red
	
	// Default
	default: "rgba(148, 163, 184, 0.4)", // Slate gray
}

export const getDocumentTypeColor = (type: string | null | undefined): string => {
	if (!type) return documentTypeColors.default as string
	const normalizedType = type.toLowerCase().replace(/\s+/g, "_")
	const color = documentTypeColors[normalizedType]
	return (color ?? documentTypeColors.default) as string
}

export const LAYOUT_CONSTANTS = {
	centerX: 400,
	centerY: 300,
	clusterRadius: 300, // Memory "bubble" size around a doc - smaller bubble
	spaceSpacing: 1600, // How far apart the *spaces* (groups of docs) sit - push spaces way out
	documentSpacing: 1000, // How far the first doc in a space sits from its space-centre - push docs way out
	minDocDist: 900, // Minimum distance two documents in the **same space** are allowed to be - sets repulsion radius
	memoryClusterRadius: 300,
}

// Graph view settings
export const GRAPH_SETTINGS = {
	console: {
		initialZoom: 0.8, // Higher zoom for console - better overview
		initialPanX: 0,
		initialPanY: 0,
	},
	consumer: {
		initialZoom: 0.5, // Changed from 0.1 to 0.5 for better initial visibility
		initialPanX: 400, // Pan towards center to compensate for larger layout
		initialPanY: 300, // Pan towards center to compensate for larger layout
	},
}

// Responsive positioning for different app variants
export const POSITIONING = {
	console: {
		legend: {
			desktop: "bottom-4 right-4",
			mobile: "bottom-4 right-4",
		},
		loadingIndicator: "top-20 right-4",

		spacesSelector: "top-4 left-4",
		viewToggle: "", // Not used in console
		nodeDetail: "top-4 right-4",
	},
	consumer: {
		legend: {
			desktop: "top-18 right-4",
			mobile: "bottom-[180px] left-4",
		},
		loadingIndicator: "top-20 right-4",

		spacesSelector: "", // Hidden in consumer
		viewToggle: "top-4 right-4", // Consumer has view toggle
		nodeDetail: "top-4 right-4",
	},
}
