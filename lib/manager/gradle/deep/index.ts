import type { Stats } from 'fs';
import { stat } from 'fs-extra';
import upath from 'upath';
import { getGlobalConfig } from '../../../config/global';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import * as datasourceMaven from '../../../datasource/maven';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { ExecOptions, exec } from '../../../util/exec';
import { readLocalFile } from '../../../util/fs';
import type {
  ExtractConfig,
  PackageFile,
  UpdateDependencyConfig,
  Upgrade,
} from '../../types';
import {
  collectVersionVariables,
  init,
  updateGradleVersion,
} from './build-gradle';
import {
  createRenovateGradlePlugin,
  extractDependenciesFromUpdatesReport,
} from './gradle-updates-report';
import type { GradleDependency } from './types';
import { extraEnv, gradleWrapperFileName, prepareGradleCommand } from './utils';

export const GRADLE_DEPENDENCY_REPORT_OPTIONS =
  '--init-script renovate-plugin.gradle renovate';
const TIMEOUT_CODE = 143;

async function prepareGradleCommandFallback(
  gradlewName: string,
  cwd: string,
  gradlew: Stats | null,
  args: string
): Promise<string> {
  const cmd = await prepareGradleCommand(gradlewName, cwd, gradlew, args);
  if (cmd === null) {
    return `gradle ${args}`;
  }
  return cmd;
}

export async function executeGradle(
  config: ExtractConfig,
  cwd: string,
  gradlew: Stats | null
): Promise<void> {
  let stdout: string;
  let stderr: string;
  let timeout;
  if (config.gradle?.timeout) {
    timeout = config.gradle.timeout * 1000;
  }
  const cmd = await prepareGradleCommandFallback(
    gradleWrapperFileName(config),
    cwd,
    gradlew,
    GRADLE_DEPENDENCY_REPORT_OPTIONS
  );
  const execOptions: ExecOptions = {
    timeout,
    cwd,
    docker: {
      image: 'gradle',
    },
    extraEnv,
  };
  try {
    logger.debug({ cmd }, 'Start gradle command');
    ({ stdout, stderr } = await exec(cmd, execOptions));
  } catch (err) /* istanbul ignore next */ {
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    if (err.code === TIMEOUT_CODE) {
      throw new ExternalHostError(err, 'gradle');
    }
    logger.warn({ errMessage: err.message }, 'Gradle extraction failed');
    return;
  }
  logger.debug(stdout + stderr);
  logger.debug('Gradle report complete');
}

export async function extractAllPackageFiles(
  config: ExtractConfig,
  packageFiles: string[]
): Promise<PackageFile[] | null> {
  let rootBuildGradle: string | undefined;
  let gradlew: Stats | null;
  const { localDir } = getGlobalConfig();
  for (const packageFile of packageFiles) {
    const dirname = upath.dirname(packageFile);
    const gradlewPath = upath.join(dirname, gradleWrapperFileName(config));
    gradlew = await stat(upath.join(localDir, gradlewPath)).catch(() => null);

    if (['build.gradle', 'build.gradle.kts'].includes(packageFile)) {
      rootBuildGradle = packageFile;
      break;
    }

    // If there is gradlew in the same directory, the directory should be a Gradle project root
    if (gradlew?.isFile() === true) {
      rootBuildGradle = packageFile;
      break;
    }
  }
  if (!rootBuildGradle) {
    logger.warn('No root build.gradle nor build.gradle.kts found - skipping');
    return null;
  }
  logger.debug('Extracting dependencies from all gradle files');

  const cwd = upath.join(localDir, upath.dirname(rootBuildGradle));

  await createRenovateGradlePlugin(cwd);
  await executeGradle(config, cwd, gradlew);

  init();

  const dependencies = await extractDependenciesFromUpdatesReport(cwd);
  if (dependencies.length === 0) {
    return [];
  }

  const gradleFiles: PackageFile[] = [];
  for (const packageFile of packageFiles) {
    const content = await readLocalFile(packageFile, 'utf8');
    if (content) {
      gradleFiles.push({
        packageFile,
        datasource: datasourceMaven.id,
        deps: dependencies,
      });

      collectVersionVariables(dependencies, content);
    } else {
      // istanbul ignore next
      logger.debug({ packageFile }, 'packageFile has no content');
    }
  }

  return gradleFiles;
}

function buildGradleDependency(config: Upgrade): GradleDependency {
  return {
    group: config.depGroup,
    name: config.name,
    version: config.currentValue,
  };
}

export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string {
  // prettier-ignore
  logger.debug(`gradle.updateDependency(): packageFile:${upgrade.packageFile} depName:${upgrade.depName}, version:${upgrade.currentValue} ==> ${upgrade.newValue}`);

  return updateGradleVersion(
    fileContent,
    buildGradleDependency(upgrade),
    upgrade.newValue
  );
}
