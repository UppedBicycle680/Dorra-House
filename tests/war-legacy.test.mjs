import test from 'node:test';
import assert from 'node:assert/strict';
import {reduceCampaign} from '../supabase/functions/dorra-api/campaign.mjs';

test('archived campaign commands cannot spend House funds or overwrite legacy progress', async () => {
  const snapshot = {balance:1250,progress:{campaign:{homeCountryId:'AU',turn:14,capitalUsd:500}}};
  const original = structuredClone(snapshot);
  for (const action of ['create','end-turn','procure','research','map-order']) {
    await assert.rejects(reduceCampaign(snapshot,{},action,{},Date.now()), {code:'CAMPAIGN_ARCHIVED'});
    assert.deepEqual(snapshot,original);
  }
});
