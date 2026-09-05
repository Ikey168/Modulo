#!/usr/bin/env python3
"""Mirror shared pack assets into the standalone frontend Docker context."""
from pathlib import Path
import sys
root=Path(__file__).resolve().parent.parent
pairs=[('backend/src/main/resources/pack-manifest-v2.schema.json','frontend/src/features/blueprint/pack/pack-manifest-v2.schema.json')]
pairs += [(f'shared/packs/{name}.v2.json',f'frontend/src/features/packs/examples/{name}.v2.json') for name in ('knowledge-base','security-audit')]
for source,target in pairs:
    content=(root/source).read_bytes()
    if '--check' in sys.argv:
        if not (root/target).exists() or (root/target).read_bytes()!=content:
            raise SystemExit(f'Pack asset differs: {target}. Run python3 scripts/sync-pack-assets.py')
    else:
        (root/target).parent.mkdir(parents=True,exist_ok=True)
        (root/target).write_bytes(content)
