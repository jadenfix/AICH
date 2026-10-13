"""Fail closed when published demo media or its recorded source drifts."""
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / "docs" / "demo"
capture = json.loads((DEMO / "capture.json").read_text())
source = capture["source_commit"]
subprocess.run(["git", "merge-base", "--is-ancestor", source, "HEAD"], cwd=ROOT, check=True)
for path, expected in capture["source_blobs"].items():
    recorded = subprocess.check_output(["git", "rev-parse", f"{source}:{path}"], cwd=ROOT, text=True).strip()
    current = subprocess.check_output(["git", "rev-parse", f"HEAD:{path}"], cwd=ROOT, text=True).strip()
    assert recorded == expected, (path, recorded, expected)
    assert current == expected, (path, current, expected)
for name, expected in capture["artifacts"].items():
    data = (DEMO / name).read_bytes()
    assert len(data) == expected["bytes"], name
    assert hashlib.sha256(data).hexdigest() == expected["sha256"], name
for name in ("aich-workspace.gif", "aich-workspace.mp4"):
    subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(DEMO / name), "-f", "null", "-"],
        check=True,
    )
print(f"Verified published demo and source {source}")
