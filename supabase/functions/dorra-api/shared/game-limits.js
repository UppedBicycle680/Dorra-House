export const MAX_BALANCE=9_000_000_000_000_000;
export const MAX_FOOTBALL_TOKENS=999_999;
export const MAX_PROTECTED_PROGRESS_BYTES=2_000_000;

export function applyDeveloperMoneyChange(currentBalance,rawAmount,operation='add'){
 const balance=Number(currentBalance),text=String(rawAmount??'').trim(),amount=Number(text);
 if(!/^\d+$/.test(text)||!Number.isSafeInteger(amount)||amount<1||amount>MAX_BALANCE)return {ok:false,balance,amount:0,delta:0,message:`Enter a whole-dollar amount from $1 to $${MAX_BALANCE.toLocaleString()}.`};
 if(!Number.isSafeInteger(balance)||balance<0||balance>MAX_BALANCE)return {ok:false,balance,amount:0,delta:0,message:'The current balance is outside the supported range.'};
 if(operation==='add'){
  if(amount>MAX_BALANCE-balance)return {ok:false,balance,amount,delta:0,message:`That would exceed the maximum balance of $${MAX_BALANCE.toLocaleString()}.`};
  return {ok:true,balance:balance+amount,amount,delta:amount,message:`$${amount.toLocaleString()} added.`};
 }
 if(operation==='remove'){
  const removed=Math.min(balance,amount);return {ok:true,balance:balance-removed,amount,delta:-removed,message:`$${removed.toLocaleString()} removed.`};
 }
 return {ok:false,balance,amount:0,delta:0,message:'Unknown developer money action.'};
}

export function applyDeveloperFootballTokenGrant(currentTokens,rawAmount){
 const tokens=Number(currentTokens),text=String(rawAmount??'').trim(),amount=Number(text);
 if(!Number.isSafeInteger(tokens)||tokens<0||tokens>MAX_FOOTBALL_TOKENS)return {ok:false,tokens,amount:0,message:'The current football-token balance is outside the supported range.'};
 if(!/^\d+$/.test(text)||!Number.isSafeInteger(amount)||amount<1||amount>MAX_FOOTBALL_TOKENS)return {ok:false,tokens,amount:0,message:`Enter a whole number from 1 to ${MAX_FOOTBALL_TOKENS.toLocaleString()} football tokens.`};
 if(amount>MAX_FOOTBALL_TOKENS-tokens)return {ok:false,tokens,amount,message:`That would exceed the football-token limit of ${MAX_FOOTBALL_TOKENS.toLocaleString()}.`};
 return {ok:true,tokens:tokens+amount,amount,message:`${amount.toLocaleString()} football token${amount===1?'':'s'} added.`};
}
