import os
import sys

# Make scripts/*.py importable as top-level modules (arch_effective_page,
# backfill_arch_history) without turning scripts/ into a package.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
