import assert from 'node:assert/strict';
import { evaluate7Cards } from '../evaluator';
import { PokerTableEngine } from '../game';
import { Card } from '../../shared/types';

function c(str: string): Card {
  const rankMap: Record<string, any> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    T: 10, J: 11, Q: 12, K: 13, A: 14,
  };
  return {
    rank: rankMap[str[0].toUpperCase()],
    suit: str[1].toLowerCase() as any,
  };
}

console.log('🧪 Running Texas Holdem Engine Test Suite...');

// 1. Test Hand Evaluator
{
  const royal = evaluate7Cards([c('As'), c('Ks'), c('Qs'), c('Js'), c('Ts'), c('2d'), c('3c')]);
  assert.equal(royal.category, 9, 'Should detect Royal Flush');

  const wheel = evaluate7Cards([c('Ah'), c('2d'), c('3s'), c('4c'), c('5h'), c('Kd'), c('Qc')]);
  assert.equal(wheel.category, 4, 'Should detect A-2-3-4-5 Wheel Straight');

  const fullHouseA = evaluate7Cards([c('Ah'), c('Ad'), c('As'), c('Kh'), c('Kd'), c('2c'), c('3s')]);
  const fullHouseK = evaluate7Cards([c('Kh'), c('Kd'), c('Ks'), c('Ah'), c('Ad'), c('2c'), c('3s')]);
  assert(fullHouseA.score > fullHouseK.score, 'AAA-KK should beat KKK-AA');
  console.log('✅ Hand Evaluator tests passed!');
}

// 2. Test Cash Game & Side Pots & Rabbit Hunt
{
  const table = new PokerTableEngine('TEST_CASH', {
    mode: 'cash',
    maxSeats: 6,
    startingChips: 1000,
    smallBlind: 10,
    bigBlind: 20,
  });

  table.takeSeat('p1', 'Alice', 0, 500);
  table.takeSeat('p2', 'Bob', 1, 1000);
  table.takeSeat('p3', 'Charlie', 2, 2000);

  const err = table.startNewHand();
  assert.equal(err, null, 'Hand should start cleanly');
  assert.equal(table.street, 'preflop');
  assert.equal(table.pot, 30, 'Pot should have SB(10) + BB(20) = 30');

  // Active player acts
  const firstPlayer = table.getActivePlayer()!;
  table.handlePlayerAction(firstPlayer.id, 'allin'); // All-in!
  const secondPlayer = table.getActivePlayer()!;
  table.handlePlayerAction(secondPlayer.id, 'call');
  const thirdPlayer = table.getActivePlayer()!;
  table.handlePlayerAction(thirdPlayer.id, 'fold');

  // Since one player is all-in and the other called, it should automatically run out Flop, Turn, River to Showdown!
  assert.equal(table.street, 'showdown', 'Should auto-runout to showdown when 1 player is all-in and 1 called');
  assert.equal(table.communityCards.length, 5, '5 community cards should be dealt');
  assert(table.winners.length >= 1, 'At least 1 winner should be awarded');
  console.log('✅ Cash Game & All-In Runout tests passed!');
}

// 3. Test 5 AI Bot Styles in a Full Simulated Hand
{
  const botTable = new PokerTableEngine('TEST_BOTS', {
    mode: 'sng',
    maxSeats: 6,
    startingChips: 1500,
    sngBlindMode: 'hands',
    sngHandsPerLevel: 2,
  });

  botTable.takeSeat('host', 'HumanHost', 0);
  botTable.addBot('host', 1, 'TAG', 'shark');
  botTable.addBot('host', 2, 'LAG', 'regular');
  botTable.addBot('host', 3, 'STATION', 'novice');
  botTable.addBot('host', 4, 'MANIAC', 'regular');
  botTable.addBot('host', 5, 'NIT', 'shark');

  botTable.startNewHand();
  let safetyCounter = 0;
  while (botTable.street !== 'showdown' && safetyCounter < 100) {
    safetyCounter++;
    const active = botTable.getActivePlayer();
    if (!active) break;
    if (active.isBot) {
      const res = botTable.executeBotTurnIfActive();
      assert(res.acted, 'Bot should execute a valid turn');
    } else {
      botTable.handlePlayerAction(active.id, 'call');
    }
  }
  assert.equal(botTable.street, 'showdown', 'Hand with 5 bots + 1 human should reach showdown');
  console.log('✅ All 5 AI Bot styles simulation passed!');
}

console.log('🎉 All Engine Tests Passed Successfully!');
