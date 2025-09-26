package config

// Application Info
const (
	AppName     = "Backthynk"
	AppTagline  = "Personal Micro Blog"
	AppDescription = "Personal micro blog platform"
)

// Reserved Routes (cannot be used as category names)
var ReservedRoutes = []string{
	"api",
	"static",
	"uploads",
	"settings",
}

// URL Configuration
const (
	URLSpaceReplacement = "_" // Replace spaces with underscores in URLs
)

// SEO Templates
const (
	SEOPageTitleTemplate     = "%s - %s"        // category name - app name
	SEODefaultTitle         = "%s - %s"         // app name - tagline
	SEOSettingsTitle        = "Settings - %s"   // app name
	SEOCategoryDescription  = "Posts in %s category" // breadcrumb
)

// IsReservedRoute checks if a route name is reserved
func IsReservedRoute(route string) bool {
	for _, reserved := range ReservedRoutes {
		if route == reserved {
			return true
		}
	}
	return false
}