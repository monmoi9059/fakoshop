import re
with open("fakoshop.html", "r") as f:
    html = f.read()

# I see what happened. `reapply_all.py` applied patches ON TOP of the existing file
# because `git checkout fakoshop.html` apparently didn't revert it properly earlier?
# Wait, I ran `git checkout fakoshop.html` but `git checkout` without `--` or branch might not have reverted?
# Actually `git checkout fakoshop.html` should revert it to HEAD. Let's do a hard reset and reapply.
