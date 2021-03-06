'use strict';

const fs = require('fs');
const cp = require('child_process');
const loadJsonFile = require('load-json-file');
const expect = require('chai').expect;
const betray = require('betray');
const nock = require('nock');
const sepia = require(`${process.cwd()}/test/util/sepia`);
const packageJsonFromData = require(`${process.cwd()}/lib/analyze/util/packageJsonFromData`);
const githubDownloader = require(`${process.cwd()}/lib/analyze/download/github`);
const npmDownloader = require(`${process.cwd()}/lib/analyze/download/npm`);
const source = require(`${process.cwd()}/lib/analyze/collect/source`);

const tmpDir = `${process.cwd()}/test/tmp`;
const fixturesDir = `${process.cwd()}/test/fixtures/analyze/collect`;

function mockExternal(mocks, dir) {
    mocks = Object.assign({ clone: () => {}, checkout: () => {} }, mocks);
    dir = dir || tmpDir;

    return betray(cp, 'exec', [
        {
            match: (command) => command.indexOf('bin/david') !== -1,
            handle: (command, options, callback) => {
                let json;

                try {
                    json = (mocks.david && mocks.david(command)) || {};
                } catch (err) {
                    return callback(err, err.stdout || '', err.stderr || '');
                }

                fs.writeFileSync(`${dir}/.npms-david.json`, JSON.stringify(json));
                callback(null, '', '');
            },
        },
        {
            match: (command) => command.indexOf('bin/nsp') !== -1,
            handle: (command, options, callback) => {
                let json;

                try {
                    json = (mocks.nsp && mocks.nsp(command)) || {};
                } catch (err) {
                    return callback(err, err.stdout || '', err.stderr || '');
                }

                fs.writeFileSync(`${dir}/.npms-nsp.json`, JSON.stringify(json));
                callback(null, '', '');
            },
        },
        {
            match: () => true,
            handle: () => { throw new Error('Not mocked'); },
        },
    ]);
}

describe('source', () => {
    before(() => sepia.fixtureDir(`${fixturesDir}/recorded/source`));
    beforeEach(() => cp.execSync(`mkdir -p ${tmpDir}`));
    afterEach(() => cp.execSync(`rm -rf ${tmpDir}`));

    it('should collect cross-spawn correctly', () => {
        sepia.enable();

        const data = loadJsonFile.sync(`${fixturesDir}/modules/cross-spawn/data.json`);
        const packageJson = packageJsonFromData('cross-spawn', data);
        const expected = loadJsonFile.sync(`${fixturesDir}/modules/cross-spawn/expected-source.json`);

        return githubDownloader(packageJson)(tmpDir)
        .then((downloaded) => {
            const betrayed = mockExternal();

            return source(data, packageJson, downloaded)
            .then((collected) => expect(collected).to.eql(expected))
            .finally(() => betrayed.restore());
        })
        .finally(() => sepia.disable());
    });

    it('should collect planify correctly', () => {
        sepia.enable();

        const data = loadJsonFile.sync(`${fixturesDir}/modules/planify/data.json`);
        const packageJson = packageJsonFromData('planify', data);
        const expected = loadJsonFile.sync(`${fixturesDir}/modules/planify/expected-source.json`);

        return githubDownloader(packageJson)(tmpDir)
        .then((downloaded) => {
            const betrayed = mockExternal();

            return source(data, packageJson, downloaded)
            .then((collected) => expect(collected).to.eql(expected))
            .finally(() => betrayed.restore());
        })
        .finally(() => sepia.disable());
    });

    it('should collect hapi correctly', () => {
        sepia.enable();

        const data = loadJsonFile.sync(`${fixturesDir}/modules/hapi/data.json`);
        const packageJson = packageJsonFromData('hapi', data);
        const expected = loadJsonFile.sync(`${fixturesDir}/modules/hapi/expected-source.json`);

        return githubDownloader(packageJson)(tmpDir)
        .then((downloaded) => {
            const betrayed = mockExternal();

            return source(data, packageJson, downloaded)
            .then((collected) => expect(collected).to.eql(expected))
            .finally(() => betrayed.restore());
        })
        .finally(() => sepia.disable());
    });

    it('should collect 0 correctly', () => {
        sepia.enable();

        const data = loadJsonFile.sync(`${fixturesDir}/modules/0/data.json`);
        const packageJson = packageJsonFromData('0', data);
        const expected = loadJsonFile.sync(`${fixturesDir}/modules/0/expected-source.json`);

        return npmDownloader(packageJson)(tmpDir)
        .then((downloaded) => {
            const betrayed = mockExternal();

            return source(data, packageJson, downloaded)
            .tap((collected) => fs.writeFileSync(`${fixturesDir}/modules/0/expected-source.json`, JSON.stringify(collected, null, 2)))
            .then((collected) => expect(collected).to.eql(expected))
            .finally(() => betrayed.restore());
        })
        .finally(() => sepia.disable());
    });

    it('should collect babbel correctly, working around NPM_TOKEN env var');

    it('should get tests size present in a variety of folders and files');

    describe('coverage', () => {
        it('should handle "unknown" coverage badge values', () => {
            nock('https://img.shields.io')
            .get('/coveralls/IndigoUnited/node-planify.json')
            .reply(200, { value: 'unknown' });

            sepia.enable();

            const data = loadJsonFile.sync(`${fixturesDir}/modules/planify/data.json`);
            const packageJson = packageJsonFromData('planify', data);

            return githubDownloader(packageJson)(tmpDir)
            .then((downloaded) => {
                const betrayed = mockExternal();

                return source(data, packageJson, downloaded)
                .then((collected) => {
                    expect(nock.isDone()).to.equal(true);
                    expect(collected.coverage).to.equal(undefined);
                })
                .finally(() => betrayed.restore());
            })
            .finally(() => {
                nock.cleanAll();
                sepia.disable();
            });
        });

        it('should handle invalid coverage badge values', () => {
            nock('https://img.shields.io')
            .get('/coveralls/IndigoUnited/node-planify.json')
            .reply(200, { value: 'foobar' });

            sepia.enable();

            const data = loadJsonFile.sync(`${fixturesDir}/modules/planify/data.json`);
            const packageJson = packageJsonFromData('planify', data);

            return githubDownloader(packageJson)(tmpDir)
            .then((downloaded) => {
                const betrayed = mockExternal();

                return source(data, packageJson, downloaded)
                .then((collected) => {
                    expect(nock.isDone()).to.equal(true);
                    expect(collected.coverage).to.equal(undefined);
                })
                .finally(() => betrayed.restore());
            })
            .finally(() => {
                nock.cleanAll();
                sepia.disable();
            });
        });

        it('should handle non-string coverage badge values', () => {
            nock('https://img.shields.io')
            .get('/coveralls/IndigoUnited/node-planify.json')
            .reply(200, { value: 1 });

            sepia.enable();

            const data = loadJsonFile.sync(`${fixturesDir}/modules/planify/data.json`);
            const packageJson = packageJsonFromData('planify', data);

            return githubDownloader(packageJson)(tmpDir)
            .then((downloaded) => {
                const betrayed = mockExternal();

                return source(data, packageJson, downloaded)
                .then((collected) => {
                    expect(nock.isDone()).to.equal(true);
                    expect(collected.coverage).to.equal(undefined);
                })
                .finally(() => betrayed.restore());
            })
            .finally(() => {
                nock.cleanAll();
                sepia.disable();
            });
        });
    });

    it('should handle broken dependencies when checking outdated with david', () => {
        sepia.enable();
        const betrayed = mockExternal({
            david: () => { throw Object.assign(new Error('foo'), { stderr: 'failed to get versions' }); },
        });

        const data = loadJsonFile.sync(`${fixturesDir}/modules/ccbuild/data.json`);
        const packageJson = packageJsonFromData('ccbuild', data);

        fs.writeFileSync(`${tmpDir}/package.json`, JSON.stringify(packageJson));

        return source(data, packageJson, { dir: tmpDir })
        .then((collected) => expect(collected.outdatedDependencies).to.equal(false))
        .finally(() => {
            sepia.disable();
            betrayed.restore();
        });
    });

    it('should handle broken dependencies when checking vulnerabilities with nsp', () => {
        const data = loadJsonFile.sync(`${fixturesDir}/modules/ccbuild/data.json`);
        const packageJson = packageJsonFromData('ccbuild', data);

        fs.writeFileSync(`${tmpDir}/package.json`, JSON.stringify(packageJson));

        // Test "Debug output: undefined"
        return Promise.try(() => {
            sepia.enable();
            const betrayed = mockExternal({
                nsp: () => { throw Object.assign(new Error('foo'), { stderr: 'Debug output: undefined\n{}\n' }); },
            });

            return source(data, packageJson, { dir: tmpDir })
            .then((collected) => expect(collected.dependenciesVulnerabilities).to.equal(false))
            .finally(() => {
                sepia.disable();
                betrayed.restore();
            });
        })
        // Test 400 status code
        .then(() => {
            sepia.enable();
            const betrayed = mockExternal({
                nsp: () => { throw Object.assign(new Error('foo'), { stderr: '"statusCode":400' }); },
            });

            return source(data, packageJson, { dir: tmpDir })
            .then((collected) => expect(collected.dependenciesVulnerabilities).to.equal(false))
            .finally(() => {
                sepia.disable();
                betrayed.restore();
            });
        });
    });

    it('should retry getting vulnerabilities if nsp seems to be unavailable', () => {
        let counter = 0;

        sepia.enable();
        const betrayed = mockExternal({
            nsp: () => {
                counter += 1;

                if (counter === 1) {
                    throw Object.assign(new Error('foo'), { stderr: '"statusCode":503' });
                } else if (counter === 2) {
                    throw Object.assign(new Error('foo'),
                        { stderr: '53,48,52,32,71,97,116,101,119,97,121,32,84,105,109,101,45,111,117,116' });
                } else if (counter === 3) {
                    throw Object.assign(new Error('foo'),
                        { stderr: 'Bad Gateway' });
                } else {
                    return ['foo'];
                }
            },
        });

        const data = loadJsonFile.sync(`${fixturesDir}/modules/cross-spawn/data.json`);
        const packageJson = packageJsonFromData('cross-spawn', data);

        fs.writeFileSync(`${tmpDir}/package.json`, JSON.stringify(packageJson));

        return source(data, packageJson, { dir: tmpDir })
        .then((collected) => expect(collected.dependenciesVulnerabilities).to.eql(['foo']))
        .finally(() => {
            sepia.disable();
            betrayed.restore();
        });
    });

    it('should retry on network errors');
});
