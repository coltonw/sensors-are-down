// @flow
/* eslint-disable node/no-unsupported-features */

export type Card = {
  cardId: ?string,
  name: string,
  description: string,
  special: ?(string | false),
  strength: number,
  damageStrength: ?number,
  shieldStrength: ?number,
  offense: ?boolean,
  defense: ?boolean,
  space: ?boolean,
  planet: ?boolean,
  count: ?number,
};

export type CardsObj = { [string]: Card };

export type Zone = {
  playerCards: Card[],
  aiCards: Card[],
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
}

export type OtherState = {
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

  // deck state
  playerDeck: CardsObj,
  aiDeck: CardsObj,
};

export type Action = {
  type: string,
  [any]: any,
};

export type State = Zones & OtherState & StateMachine;
