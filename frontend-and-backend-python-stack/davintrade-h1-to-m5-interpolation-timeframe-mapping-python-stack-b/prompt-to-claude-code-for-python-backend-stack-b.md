Prompt to Claude Code:

I have uploaded two architecture documents:

davintrade-python-backend-architecture-v2.md — Python Backend Stack A (existing system)
davintrade-python-backend-stack-b-architecture-v1.md — Python Backend Stack B (new system to implement)

Please read both documents thoroughly, then implement Python Backend Stack B exactly as specified in davintrade-python-backend-stack-b-architecture-v1.md.
Key implementation notes:

Stack B is a downstream consumer of Stack A. Do not modify any Stack A code.
Implement all functions in Section 5 exactly as written: merge_h1_onto_m5_grid(), interpolate_h1_anchors(), build_interpolated_output(), \_validate_interpolation_inputs(), and run_h1m5_interpolation_pipeline().
Implement compute_ssa_cross_signal() from Section 6.3.
Implement execute_full_pipeline() and \_map_entropy_to_regime() from Section 8 as the unified Stack A + Stack B master entry point.
Implement verify_stack_b_against_reference() from Section 11 as a standalone verification script.
Extend the Phase 6 config schema with the interp_h1m5 block as shown in Section 7.
All architectural principles in Section 12 are hard constraints — zero NaN output, no for-loops over DatetimeIndex, no staircase artifacts, no re-computation of SSA inside Stack B.
