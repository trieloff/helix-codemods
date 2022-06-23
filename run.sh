#!/bin/sh
git ls-remote --heads git@github.com:$1/$2.git advancedrum | grep advancedrum
if [ $? -eq 0 ]; then
  echo "branch advancedrum already exists"
  exit 0
fi
gh repo clone $1/$2 $3
cd $3 $2
echo $PWD

git checkout -b advancedrum
echo "feat(rum): add advanced rum tracking" > log.txt
jscodeshift -t ../transforms/advancedrum.js .
echo "" >> log.txt
echo "" >> log.txt
echo "Test URLs" >> log.txt
echo " - before: https://main--$2--$1.hlx.page/?rum=on" >> log.txt
echo " - after:  https://advancedrum--$2--$1.hlx.page/?rum=on" >> log.txt
echo "" >> log.txt
echo "Edits performed by https://github.com/trieloff/helix-codemods/blob/main/transforms/advancedrum.js" >> log.txt
git add -A
git reset HEAD -- log.txt
# only do this if there are changes
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  git commit -F log.txt
  gh pr create -f
fi
cd ..
rm -rf $3 $2