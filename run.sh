#!/bin/sh
rm -rf $2
gh repo clone $1/$2
cd $2
echo $PWD
git checkout -b advancedrum
echo "feat(rum): add advanced rum tracking" > log.txt
jscodeshift -t ../transforms/advancedrum.js scripts
echo "" >> log.txt
echo "" >> log.txt
echo "Test URLs" >> log.txt
echo " - before: https://main--$2--$1.hlx.page/?rum=on" >> log.txt
echo " - after:  https://advancedrum--$2--$1.hlx.page/?rum=on" >> log.txt
echo "" >> log.txt
echo "Edits performed by https://github.com/trieloff/helix-codemods/blob/main/transforms/advancedrum.js" >> log.txt
git add scripts
git commit -F log.txt
gh pr create -f
cd ..