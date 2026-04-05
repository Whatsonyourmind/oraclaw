# Ravenwater universal #196 Research — Apr 5, 2026

## Issue Summary

**Title:** Visualization of the ubox of unum Type I
**State:** OPEN | **Labels:** enhancement, good-first-issue, help-wanted | **Milestone:** V4
**Ask:** Visualize expansion/contraction of ubox intervals during computation. Educational/debugging tool.

## Scope Assessment: 4-8 hours (medium)

**Why not 2 hours:** No existing interval visualization code. Needs multi-frame output + understanding of ubound semantics.
**Why not 20 hours:** Good-first-issue label, PNG encoder exists, ubound class ready, recent PRs merge in 30-60 min.

## Key Files

| File | Purpose |
|------|---------|
| `include/sw/universal/number/unum/ubound.hpp` | Interval class (253 LOC) |
| `elastic/unum/ubox.cpp` | Existing tests (200 LOC) |
| `include/sw/universal/utility/png_encoder.hpp` | PNG output utility |
| `include/sw/universal/utility/closure_plot_png.hpp` | Plot generation pattern |
| `applications/mixed-precision/imaging/ulp_visual_demo.cpp` | Visual demo reference |

## Tech Stack
- C++ (CMake 3.22+)
- Tests auto-discovered via glob
- PR template: Summary, Changes, Test Results, Test Plan
- Recent PRs merge in 30-60 minutes

## Implementation Plan (US-601)

1. Fork stillwater-sc/universal
2. Study ubound.hpp (interval class with ispoint, width, midpoint, contains)
3. Write visualization function using existing PNG encoder
4. Show ubox evolution during: addition of inexact values, multiplication chains
5. Add test cases to elastic/unum/
6. Submit PR referencing issue #196, zero OraClaw mentions
