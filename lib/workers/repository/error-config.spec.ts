import { mock } from 'jest-mock-extended';
import {
  RenovateConfig,
  getConfig,
  getName,
  platform,
} from '../../../test/util';
import { setGlobalConfig } from '../../config/global';
import { CONFIG_VALIDATION } from '../../constants/error-messages';
import { Pr } from '../../platform';
import { PrState } from '../../types';
import { raiseConfigWarningIssue } from './error-config';

jest.mock('../../platform');

let config: RenovateConfig;
beforeEach(() => {
  jest.resetAllMocks();
  config = getConfig();
});

describe(getName(), () => {
  describe('raiseConfigWarningIssue()', () => {
    beforeEach(() => {
      setGlobalConfig();
    });
    it('creates issues', async () => {
      const error = new Error(CONFIG_VALIDATION);
      error.validationSource = 'package.json';
      error.validationMessage = 'some-message';
      platform.ensureIssue.mockResolvedValueOnce('created');
      const res = await raiseConfigWarningIssue(config, error);
      expect(res).toBeUndefined();
    });
    it('creates issues (dryRun)', async () => {
      const error = new Error(CONFIG_VALIDATION);
      error.validationSource = 'package.json';
      error.validationMessage = 'some-message';
      platform.ensureIssue.mockResolvedValueOnce('created');
      setGlobalConfig({ dryRun: true });
      const res = await raiseConfigWarningIssue(config, error);
      expect(res).toBeUndefined();
    });
    it('handles onboarding', async () => {
      const error = new Error(CONFIG_VALIDATION);
      error.validationSource = 'package.json';
      error.validationMessage = 'some-message';
      platform.getBranchPr.mockResolvedValue({
        ...mock<Pr>(),
        number: 1,
        state: PrState.Open,
      });
      const res = await raiseConfigWarningIssue(config, error);
      expect(res).toBeUndefined();
    });
    it('handles onboarding (dryRun)', async () => {
      const error = new Error(CONFIG_VALIDATION);
      error.validationSource = 'package.json';
      error.validationMessage = 'some-message';
      platform.getBranchPr.mockResolvedValue({
        ...mock<Pr>(),
        number: 1,
        state: PrState.Open,
      });
      setGlobalConfig({ dryRun: true });
      const res = await raiseConfigWarningIssue(config, error);
      expect(res).toBeUndefined();
    });
  });
});
