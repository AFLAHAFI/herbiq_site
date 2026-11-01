import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { PLANTS, searchPlants, getPlantByHerbiqId, findPlantInQuestion } from '../src/data/plants';
test('all existing plants have unique IDs, QR IDs and working local images', () => {
  assert.equal(PLANTS.length, 27);
  assert.equal(new Set(PLANTS.map(p => p.id)).size, 27);
  assert.equal(new Set(PLANTS.map(p => p.herbiqId)).size, 27);
  for (const plant of PLANTS) {
    assert.ok(existsSync(`public${plant.image}`), plant.id);
    assert.equal(getPlantByHerbiqId(` ${plant.herbiqId.toLowerCase()} `)?.id, plant.id);
    if (plant.model3D) assert.ok(existsSync(`public${plant.model3D}`));
  }
});
test('search supports names, Malayalam, taxonomy, categories and empty results', () => {
  for (const q of ['Tulsi','തുളസി','Ocimum']) assert.equal(searchPlants(q)[0]?.id, 'tulsi');
  assert.equal(searchPlants('tulsi','Tree').length, 0);
  assert.equal(searchPlants('not-a-plant-123').length, 0);
  assert.equal(getPlantByHerbiqId('HERBIQ:missing'), undefined);
});
test('plant questions and every profile-generated question resolve correctly', () => {
  assert.equal(findPlantInQuestion('What is Tulsi?')?.id, 'tulsi');
  assert.equal(findPlantInQuestion('Tell me about തുളസി')?.id, 'tulsi');
  assert.equal(findPlantInQuestion('How can I identify Neem?')?.id, 'neem');
  assert.equal(findPlantInQuestion('minted coins'), undefined);
  for (const p of PLANTS) assert.equal(findPlantInQuestion(`Tell me about ${p.name} and its traditional uses.`)?.id, p.id);
});
