# Changelog

All notable changes to Backthynk will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 10/08/2025

Intitial version of Backthynk.

Simple but working version with straightforward features.

What has been done:
Minimalistic and portable architecture using in Golang and Sqlite in the back-end to ensure cross-platform compatibility / portability making sure it runs everywhere.

Lightweight and super fast in front-end using only pure CSS and vanilla JS with no external dependencies, no external fonts.
It's also intended to be SEO friendly. (when deployment setup ready)


What is yet to be done for a correct 1.0.0 release:

- Deployment : Currently you can't publish your backthynk space over the internet, there's no deployment setup, no auth.
- Post route : Currently there is no route for linking a post that has to be designed rendered on the server side.
- Markdown support : While the current version is enough to share small ideas, little text, urls, files and quick things; yet it's not adapated for longer format like a regular blog post, markdown has to be supported but it's a sort of big work as the back-end needs to have its own md to html converter engine. (handling that on the front-end side is out-of-question to keep the downloaded bundle as lightweight as possible)
- Auth : Currently anyone reaching the url can use freely ANY available functionnality, we need to implement a login/access system where it could be defined who can do what, either based on an account or a key. Yet to define.
- Front-end unit-testing implementation and more robust back-end unit-testing. (With maybe a better design if a UI designer is willing to contribute)

---

## Template for Future Releases

Copy this template when creating a new release:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes in existing functionality

### Deprecated
- Soon-to-be removed features

### Removed
- Removed features

### Fixed
- Bug fixes

### Security
- Security fixes
```
