import { campaignDefinitionId, scenarioId } from '../ids';
import { describe, expect, it } from 'vitest';
import { daisy, roland } from '../../test/utils';
import { compileCampaign, type CampaignDefinition } from './campaign_definition';

describe('compileCampaign', () => {
  const definition: CampaignDefinition = {
    id: campaignDefinitionId('test_campaign'),
    scenarios: [scenarioId('first_scenario'), scenarioId('second_scenario')],
    chaosBag: {
      easy: ['+1', '0'],
      standard: ['0', '-1'],
      hard: ['-1', '-2'],
      expert: ['-2', '-3'],
    },
  };

  it('builds a StartCampaign with the bag of the chosen difficulty and the scenario order', () => {
    expect(
      compileCampaign(definition, {
        campaignId: 'campaign_a',
        difficulty: 'hard',
        investigators: [roland.code, daisy.code],
      }),
    ).toEqual({
      type: 'StartCampaign',
      campaignId: 'campaign_a',
      definitionId: 'test_campaign',
      difficulty: 'hard',
      investigators: [roland.code, daisy.code],
      chaosBag: ['-1', '-2'],
      scenarioIds: ['first_scenario', 'second_scenario'],
    });
  });
});
