import { withDir } from 'tmp-promise';
import { join } from 'upath';
import { envMock } from '../../../test/exec-util';
import { getName, mocked } from '../../../test/util';
import { setGlobalConfig } from '../../config/global';
import * as _env from '../exec/env';
import {
  ensureCacheDir,
  ensureLocalDir,
  exists,
  findLocalSiblingOrParent,
  getSubDirectory,
  localPathExists,
  readLocalDirectory,
  readLocalFile,
  writeLocalFile,
} from '.';

jest.mock('../../util/exec/env');
const env = mocked(_env);

describe(getName(), () => {
  describe('readLocalFile', () => {
    beforeEach(() => {
      setGlobalConfig({ localDir: '' });
    });

    it('reads buffer', async () => {
      expect(await readLocalFile(__filename)).toBeInstanceOf(Buffer);
    });
    it('reads string', async () => {
      expect(typeof (await readLocalFile(__filename, 'utf8'))).toBe('string');
    });

    it('does not throw', async () => {
      // Does not work on FreeBSD: https://nodejs.org/docs/latest-v10.x/api/fs.html#fs_fs_readfile_path_options_callback
      expect(await readLocalFile(__dirname)).toBeNull();
    });
  });
});

describe(getName(), () => {
  describe('localPathExists', () => {
    it('returns true for file', async () => {
      expect(await localPathExists(__filename)).toBe(true);
    });
    it('returns true for directory', async () => {
      expect(await localPathExists(getSubDirectory(__filename))).toBe(true);
    });
    it('returns false', async () => {
      expect(await localPathExists(__filename.replace('.ts', '.txt'))).toBe(
        false
      );
    });
  });
});

describe(getName(), () => {
  describe('findLocalSiblingOrParent', () => {
    it('returns path for file', async () => {
      await withDir(
        async (localDir) => {
          setGlobalConfig({
            localDir: localDir.path,
          });

          await writeLocalFile('crates/one/Cargo.toml', '');
          await writeLocalFile('Cargo.lock', '');

          expect(
            await findLocalSiblingOrParent(
              'crates/one/Cargo.toml',
              'Cargo.lock'
            )
          ).toBe('Cargo.lock');
          expect(
            await findLocalSiblingOrParent(
              'crates/one/Cargo.toml',
              'Cargo.mock'
            )
          ).toBeNull();

          await writeLocalFile('crates/one/Cargo.lock', '');

          expect(
            await findLocalSiblingOrParent(
              'crates/one/Cargo.toml',
              'Cargo.lock'
            )
          ).toBe('crates/one/Cargo.lock');
          expect(
            await findLocalSiblingOrParent('crates/one', 'Cargo.lock')
          ).toBe('Cargo.lock');
          expect(
            await findLocalSiblingOrParent(
              'crates/one/Cargo.toml',
              'Cargo.mock'
            )
          ).toBeNull();
        },
        {
          unsafeCleanup: true,
        }
      );
    });

    it('immediately returns null when either path is absolute', async () => {
      expect(await findLocalSiblingOrParent('/etc/hosts', 'other')).toBeNull();
      expect(await findLocalSiblingOrParent('other', '/etc/hosts')).toBeNull();
    });
  });

  describe('readLocalDirectory', () => {
    it('returns dir content', async () => {
      await withDir(
        async (localDir) => {
          setGlobalConfig({
            localDir: localDir.path,
          });
          await writeLocalFile('test/Cargo.toml', '');
          await writeLocalFile('test/Cargo.lock', '');

          const result = await readLocalDirectory('test');
          expect(result).not.toBeNull();
          expect(result).toBeArrayOfSize(2);
          expect(result).toMatchSnapshot();

          await writeLocalFile('Cargo.lock', '');
          await writeLocalFile('/test/subdir/Cargo.lock', '');

          const resultWithAdditionalFiles = await readLocalDirectory('test');
          expect(resultWithAdditionalFiles).not.toBeNull();
          expect(resultWithAdditionalFiles).toBeArrayOfSize(3);
          expect(resultWithAdditionalFiles).toMatchSnapshot();
        },
        {
          unsafeCleanup: true,
        }
      );
    });

    it('return empty array for non existing directory', async () => {
      await withDir(
        async (localDir) => {
          setGlobalConfig({
            localDir: localDir.path,
          });
          await expect(readLocalDirectory('somedir')).rejects.toThrow();
        },
        {
          unsafeCleanup: true,
        }
      );
    });

    it('return empty array for a existing but empty directory', async () => {
      await ensureLocalDir('somedir');
      const result = await readLocalDirectory('somedir');
      expect(result).not.toBeNull();
      expect(result).toBeArrayOfSize(0);
    });
  });

  describe('ensureCacheDir', () => {
    function setupMock(root: string): {
      dirFromEnv: string;
      dirFromConfig: string;
    } {
      const dirFromEnv = join(root, join('/bar/others/bundler'));
      const dirFromConfig = join(root, join('/bar'));

      jest.resetAllMocks();
      env.getChildProcessEnv.mockReturnValueOnce({
        ...envMock.basic,
      });

      setGlobalConfig({
        cacheDir: join(dirFromConfig),
      });

      return { dirFromEnv, dirFromConfig };
    }

    it('prefers environment variables over global config', async () => {
      await withDir(
        async (tmpDir) => {
          const { dirFromEnv } = setupMock(tmpDir.path);
          const res = await ensureCacheDir('bundler');
          expect(res).toEqual(dirFromEnv);
          expect(await exists(dirFromEnv)).toBeTrue();
        },
        { unsafeCleanup: true }
      );
    });
  });
});
