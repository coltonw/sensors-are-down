// @flow
/* eslint-disable node/no-unsupported-features */

export type Card = {
  name: string,
  description: string,
  special: ?(string | false),
  generated: ?boolean,
  strength: number,
  damageStrength: ?number,
  shieldStrength: ?number,
  armorStrength: ?number,
  offense: ?boolean,
  defense: ?boolean,
  development: ?boolean,
  space: ?boolean,
  land: ?boolean,
  tribe: ?string,
  count: ?number,
  raw: ?{
    [string]: any,
  },
  recharge: ?number,
  recharging: ?number,
  tank: ?boolean,
  shy: ?boolean,
  offensePriority: ?('low' | 'high'),
  defensePriority: ?('low' | 'high'),
};

export type PlayedCard = Card & {
  cardId: string,
  cardUid: string,
  turnPlayed: number,
  phasePlayed: string,
};

// this should be keyed by cardId
export type CardsObj = { [string]: Card };

// this should be keyed by cardUid
export type PlayedCardsMap = { [string]: PlayedCard };

export type Zone = {
  playerCards: PlayedCard[],
  aiCards: PlayedCard[],
  playerGraveyard: PlayedCard[],
  aiGraveyard: PlayedCard[],
};

export type Ship = Zone & {
  shipDamage: number,
};

export type Planet = Zone & {
  playerEntrenched: boolean,
  aiEntrenched: boolean,
};

export type Zones = {
  ships: {
    playerShip: Ship,
    aiShip: Ship,
  },
  planet: Planet,
};

export type SpecialVictory = {
  playerShipDamage?: boolean,
  aiShipDamage?: boolean,
  playerEntrenching?: boolean,
  aiEntrenching?: boolean,
}

export type StateMachine = {
  offenseCardChoices: ?{
    playerCards: CardsObj,
    aiCards: CardsObj,
  },
  defenseCardChoices: ?{
    playerCards: CardsObj,
    aiCards: CardsObj,
  },
  error: ?string,
  gameEndResults: ?{
    playerShipDefeat?: true,
    playerShipVictory?: true,
    playerPlanetVictory?: true,
    drawStalemate?: true,
    playerPlanetDefeat?: true,
    playerTiebreakerVictory?: true,
    drawShipsDestroyed?: true,
    playerTiebreakerDefeat?: true,
  },
};

export type OtherState = {
  currentTurn: number,

  prevState: Zones & {
    offenseCardChoices: ?{
      playerCards: CardsObj,
      aiCards: CardsObj,
    },
    defenseCardChoices: ?{
      playerCards: CardsObj,
      aiCards: CardsObj,
    },
  },

  allCards: CardsObj,

  // deck state
  playerDeck: CardsObj,
  aiDeck: CardsObj,
};

export type Action = {
  type: string,
  [any]: any,
};

export type State = Zones & OtherState & StateMachine;
