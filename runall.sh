#!/bin/bash
# multiline echo statement
JSON=$(echo "SELECT req_http_X_Owner, req_http_X_Repo, COUNT(*) AS requests FROM \`helix-225321.helix_logging_7TvULgs0Xnls4q3R8tawdg.requests20*\` 
WHERE req_http_X_Owner != '' AND status_code = '200'
GROUP BY req_http_X_Repo, req_http_X_Owner
ORDER BY requests DESC
LIMIT 1000" | bq query --use_legacy_sql=false --format json -n 30)

SKIPPEDREPOS="hlxsites/eecol adobe/acom-reviews"

COUNTER=0
# loop over each object in json array
for i in $(echo $JSON | jq -r '.[] | @base64 '); do
  OWNER=$(echo $i | base64 --decode | jq -r '.req_http_X_Owner')
  REPO=$(echo $i | base64 --decode | jq -r '.req_http_X_Repo')
  FORK=$(gh repo view $OWNER/$REPO --json isFork --jq '.isFork')
  # increase counter
  COUNTER=$((COUNTER+1))

  # if counter is smaller than 20, then skip
  if [ $COUNTER -lt 20 ]; then
    continue
  fi

  # if repo is in skipped repos, then skip
  if [[ $SKIPPEDREPOS =~ $OWNER/$REPO ]]; then
    continue
  fi

  # if FORK is true, skip
  if [ "$FORK" = "true" ]; then
    continue
  fi
  echo "Processing $COUNTER: https://github.com/$OWNER/$REPO"
  ./run.sh $OWNER $REPO repo-$COUNTER
  
done