import subprocess

def run(cmd):
    subprocess.run(cmd, shell=True, check=True)

# 1. Stash all current changes
run("git stash")

# Commit 1: Step 1 Offline Box (ReportSteps.tsx)
run("git checkout stash@{0} -- front/src/components/modals/ReportSteps.tsx")
# We need to remove the Step 3 changes from ReportSteps.tsx for this commit
# Actually, the easiest way is to apply the full diff in chunks.
