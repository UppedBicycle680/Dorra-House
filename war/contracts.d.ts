/** Version 1 public contracts. PlayerView contains server projections only. */
export type Resource = 'cash' | 'supplies' | 'fuel' | 'electronics' | 'manpower';
export type Resources = Record<Resource, number>;
export type AIDifficulty = 'recruit' | 'standard' | 'veteran';
export interface MatchConfig {
  template: 'duel' | 'world'; opponent: 'ai' | 'human'; pace: 'fast' | 'persistent';
  visibility: 'public' | 'invite'; name: string; nationId: string; opponentNationId?: string; aiDifficulty?: AIDifficulty;
}
export type OrderType = 'move' | 'attack' | 'patrol' | 'bombard' | 'retreat' | 'intercept' | 'embark' | 'split' | 'merge';
export type WarIntent =
  | {action:'create'; args:MatchConfig}
  | {action:'list'; args:{inviteCode?:string;matchId?:string}}
  | {action:'join';args:{nationId:string;inviteCode?:string}}
  | {action:'view'|'start'|'pause'|'resume'|'retire'|'reward';args:Record<string,never>}
  | {action:'gold-wallet';args:Record<string,never>}
  | {action:'boost-quote';args:{queueId:string}}
  | {action:'boost';args:{quoteId:string;confirmed:true}}
  | {action:'research';args:{platformId:string}}
  | {action:'produce';args:{provinceId:string;platformId:string}}
  | {action:'build';args:{provinceId:string;facility:string}}
  | {action:'diplomacy';args:{nationId:string;type:string;resources?:Partial<Resources>;platformId?:string}}
  | {action:'order';args:{unitIds:string[];type:OrderType;targetProvinceId?:string;targetUnitId?:string;waypoints?:string[]}};
export type WarCommand = WarIntent & {protocolVersion:1;leaseId:string;requestId:string;matchId?:string;baseRevision?:number|null};
export interface PlayerView {
  match:{id:string;revision:number;status:'lobby'|'running'|'paused'|'finished';gameTime:number;speed:number;pace:MatchConfig['pace'];template:MatchConfig['template'];hostId:string;aiDifficulty?:AIDifficulty|null;opponentNationId?:string|null};
  player:{userId:string;nationId:string;resources:Resources;research:string[];researchQueue:unknown[];productionQueue:unknown[];buildQueue:unknown[]};
  nations:{id:string;name:string;ownerId:string|null;relation:string;score:number;capitalProvinceId:string}[];
  provinces:{id:string;ownerId:string;morale:number|null;facilities:Record<string,number>|null;radiationUntil:number}[];
  units:{id:string;name:string;domain:'land'|'air'|'sea'|'support'|'missile';nationId:string;provinceId:string;platformId:string;health:number;maxHealth:number;strength:number;order:unknown|null;supply?:number;entrenchment?:number;baseCarrierId?:string|null;interceptReadyAt?:number}[];
  reports:unknown[];diplomacy:unknown;victory:unknown;catalog:unknown;
}
/** Membership-filtered entity changes; a base mismatch requires a fresh view. */
export interface WarDelta {matchId:string;baseRevision:number;revision:number;fields?:Partial<Pick<PlayerView,'match'|'player'|'nations'|'reports'|'diplomacy'|'catalog'|'victory'>>;units:{upsert:PlayerView['units'];remove:string[]};provinces:{upsert:PlayerView['provinces'];remove:string[]}}
export interface GoldWallet {
  balance:number; version:number; purchasesAvailable:false; pricingVersion:string; goldPerGameHour:number;
  history?:{id:string;kind:'admin-award'|'victory-reward'|'boost';amount:number;balanceAfter:number;reason:string;createdAt:string;matchId:string|null}[];
}
export interface BoostQuote {quoteId:string;queueId:string;kind:'research'|'produce'|'build';label:string;goldCost:number;remainingGameSeconds:number;expiresAt:string;pricingVersion:string}
export interface WarResponse {protocolVersion:1;view?:PlayerView;delta?:WarDelta;replayed?:boolean;gold?:GoldWallet;quote?:BoostQuote;result?:unknown}
