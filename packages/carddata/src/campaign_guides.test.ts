import { describe, expect, it } from 'vitest';
import { layoutReport, scenarioLayouts } from './index';

// Hand-written fake guide data in ArkhamCards' shape – never real guide text.
function scenarioWith(...steps: object[]) {
  return { id: 'fake_scenario', scenario_name: 'Fake Scenario', steps };
}

function locationSetup(fields: object) {
  return {
    id: 'location_layout',
    type: 'location_setup',
    text: 'Location Placement',
    horizontal: 'normal',
    vertical: 'normal',
    ...fields,
  };
}

describe('scenarioLayouts', () => {
  it('reads card cells by code and side, leaving out blank cells', () => {
    const scenario = scenarioWith(
      locationSetup({
        locations: [
          ['90001', 'blank'],
          ['blank', '90002_back'],
        ],
      }),
    );

    expect(scenarioLayouts(scenario).layouts[0]?.slots).toEqual([
      { kind: 'card', code: '90001', side: 'front', at: { column: 0, row: 0 } },
      { kind: 'card', code: '90002', side: 'back', at: { column: 1, row: 1 } },
    ]);
  });

  it.each([
    { cell: '90003a_back', code: '90003a', reading: 'a lettered code' },
    { cell: '90004_backc', code: '90004', reading: 'a lettered back' },
    { cell: '90005_back_rotate_left', code: '90005', reading: 'a rotated card' },
  ])('reads $reading as its card', ({ cell, code }) => {
    const scenario = scenarioWith(locationSetup({ locations: [[cell]] }));

    expect(scenarioLayouts(scenario).layouts[0]?.slots).toEqual([
      { kind: 'card', code, side: 'back', at: { column: 0, row: 0 } },
    ]);
  });

  it('labels a named slot with the guide name, and leaves a slot without one unnamed', () => {
    const scenario = scenarioWith(
      locationSetup({
        locations: [['fake_docks', 'placeholder']],
        location_names: [{ code: 'fake_docks', name: 'Fake Docks' }],
      }),
    );

    expect(scenarioLayouts(scenario).layouts[0]?.slots).toEqual([
      { kind: 'named', key: 'fake_docks', name: 'Fake Docks', at: { column: 0, row: 0 } },
      { kind: 'named', key: 'placeholder', at: { column: 1, row: 0 } },
    ]);
  });

  it.each([
    { horizontal: 'half', vertical: 'normal', at: { column: 1, row: 2 } },
    { horizontal: 'normal', vertical: 'half', at: { column: 2, row: 1 } },
  ])(
    'puts cells half a card step apart with $horizontal × $vertical spacing',
    ({ horizontal, vertical, at }) => {
      const scenario = scenarioWith(
        locationSetup({
          horizontal,
          vertical,
          locations: [['blank'], ['blank'], ['blank', 'blank', '90006']],
        }),
      );

      expect(scenarioLayouts(scenario).layouts[0]?.slots[0]?.at).toEqual(at);
    },
  );

  it('reads an unknown spacing as a full card step and lists it', () => {
    const scenario = scenarioWith(
      locationSetup({ horizontal: 'tight', locations: [['blank', '90007']] }),
    );

    const layout = scenarioLayouts(scenario).layouts[0];

    expect(layout?.slots[0]?.at).toEqual({ column: 1, row: 0 });
    expect(layout?.unknownSpacing).toEqual(['horizontal: tight']);
  });

  it('counts the diagram parts it does not read', () => {
    const scenario = scenarioWith(
      locationSetup({ locations: [['90008']], arrows: [{}, {}], annotations: [] }),
    );

    expect(scenarioLayouts(scenario).layouts[0]?.skipped).toEqual({ arrows: 2 });
  });

  it('keeps every layout in step order and skips the other steps', () => {
    const scenario = scenarioWith(
      locationSetup({ id: 'layout_dawn', text: 'Dawn', locations: [['90009']] }),
      { id: 'encounter_deck', text: 'Shuffle the fake encounter deck.' },
      locationSetup({ id: 'layout_dusk', text: 'Dusk', locations: [['90010']] }),
    );

    expect(scenarioLayouts(scenario).layouts.map((layout) => layout.id)).toEqual([
      'layout_dawn',
      'layout_dusk',
    ]);
  });

  it('names a file without a scenario name, a campaign-wide core.json, by its id', () => {
    const campaignSteps = { id: 'core', steps: [] };

    expect(scenarioLayouts(campaignSteps).name).toBe('core');
  });

  it('rejects a location step whose grid is no longer rows of cells', () => {
    const scenario = scenarioWith(locationSetup({ locations: ['90011'] }));

    expect(() => scenarioLayouts(scenario)).toThrow();
  });
});

describe('layoutReport', () => {
  it('lists each layout with its slots and what is left to do by hand', () => {
    const scenario = scenarioWith(
      locationSetup({
        horizontal: 'tight',
        locations: [['90012_back', 'fake_hideout']],
        arrows: [{}],
        note: 'A fake note.',
      }),
    );

    expect(layoutReport([scenarioLayouts(scenario)])).toEqual([
      'Fake Scenario (fake_scenario)',
      '  Location Placement (location_layout): 90012 (back) @0,0, fake_hideout @1,0',
      '    unnamed slots: fake_hideout',
      '    not imported: arrows ×1',
      '    unknown spacing, read as one step: horizontal: tight',
    ]);
  });

  it('says when a scenario has no layout', () => {
    expect(layoutReport([scenarioLayouts(scenarioWith())])).toEqual([
      'Fake Scenario (fake_scenario)',
      '  no location layout: place the locations by hand',
    ]);
  });
});
