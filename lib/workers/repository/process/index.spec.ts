import {
  RenovateConfig,
  getConfig,
  getName,
  git,
  mocked,
} from '../../../../test/util';
import * as _extractUpdate from './extract-update';
import { extractDependencies, updateRepo } from '.';

jest.mock('../../../util/git');
jest.mock('./extract-update');

const extract = mocked(_extractUpdate).extract;

let config: RenovateConfig;
beforeEach(() => {
  jest.resetAllMocks();
  config = getConfig();
});

describe(getName(), () => {
  describe('processRepo()', () => {
    it('processes single branches', async () => {
      const res = await extractDependencies(config);
      // FIXME: explicit assert condition
      expect(res).toMatchSnapshot();
    });
    it('processes baseBranches', async () => {
      extract.mockResolvedValue({} as never);
      config.baseBranches = ['branch1', 'branch2'];
      git.branchExists.mockReturnValueOnce(false);
      git.branchExists.mockReturnValueOnce(true);
      git.branchExists.mockReturnValueOnce(false);
      git.branchExists.mockReturnValueOnce(true);
      const res = await extractDependencies(config);
      await updateRepo(config, res.branches);
      // FIXME: explicit assert condition
      expect(res).toMatchSnapshot();
    });
  });
});
