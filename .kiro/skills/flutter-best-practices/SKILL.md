---
name: flutter-best-practices
description: "Use when writing, reviewing, refactoring, or planning Flutter/Dart code — screens, features, project structure, state management, folders, widgets, cubits/blocs, repositories, services, or tests."
license: MIT
---

# Flutter Best Practices
Standards for building maintainable Flutter apps, distilled from the official Flutter architecture guide and LeanCode's experience shipping 40+ Flutter projects (including a 30-developer banking app). Apply these when writing new code; when touching existing code, prefer consistency with the surrounding codebase and raise conflicts with these standards rather than silently rewriting.

## Core rules (always apply)

### Architecture
1. **Separate UI from data.** Two broad layers: UI (views + view models / cubits) and Data (repositories + services). Dependencies point one way: `View → ViewModel → Repository → Service`. Lower layers never import upper layers. Repositories never depend on each other.
2. **Views hold no business logic.** Widgets may contain show/hide conditionals, animation, layout, and simple routing logic — nothing that transforms or decides about data. All data logic lives in the view model (or cubit/bloc), which has no access to `BuildContext`.
3. **Organize by feature, not by layer.** Everything a feature needs — state management, widgets, models — lives under one feature directory.
4. **State is immutable and explicit.** Model UI state as a sealed/union type (initial / inProgress / failure / ready) so every case is handled exhaustively.
5. **Add layers only when they pay for themselves.** Start with view-model → API client.

### Coding
6. **Prefer intent-revealing widgets over `Container`.** Use `Padding`, `SizedBox`, `ColoredBox`, `DecoratedBox`, `Center` — they are const-able and self-describing.
7. **Use modern Dart.** Pattern matching, switch expressions, records/destructuring, collection `if`/`for`/spreads.
8. **Prefix sliver-returning widgets with `Sliver`** so misuse in the wrong scroll context is caught at a glance.
9. **Tests tell a story.** Use expressive matchers and minimize dependencies.
10. **Every `// ignore:` gets a reason** on the same or preceding line.

## Performance
- Use `const` constructors wherever possible
- Extract static widgets to separate const classes
- Use `Key` for list items (`ValueKey`, `ObjectKey`)
- `RepaintBoundary` for complex animations
- `ListView.builder` for any list > 10 items
- `compute()` for heavy computation (JSON parsing, image processing)
- `cached_network_image` with `memCacheWidth`/`memCacheHeight`

## Checklist
- [ ] `const` constructors on all static widgets
- [ ] Proper `Key` on list items
- [ ] No widget building inside `build()` method
- [ ] Extract reusable widgets to separate files
- [ ] Immutable state objects
- [ ] Dispose controllers and subscriptions in `dispose()`
- [ ] Handle loading/error states
- [ ] Images cached and resized to display dimensions
- [ ] Heavy computation in isolates

## Source
- [Flutter app architecture guide](https://docs.flutter.dev/app-architecture/guide)
- [evanca/flutter-ai-rules](https://github.com/evanca/flutter-ai-rules) — MIT
