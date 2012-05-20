var buster = require("buster");
var cliHelper = require("buster-cli/lib/test-helper");
var testCli = require("../lib/test-cli");
var analyzer = require("buster-analyzer").analyzer;

function fakeRunner(thisp, environment) {
    return { environment: environment, run: thisp.stub().yields() };
}

function testArgumentOption(args, options) {
    return function (done) {
        this.cli.run(["-c", this.config].concat(args), done(function () {
            assert.match(this.runners.browser.run.args[0][1], options);
        }.bind(this)));
    };
}

buster.testCase("Test CLI", {
    setUp: function () {
        this.stdout = cliHelper.writableStream("stdout");
        this.stderr = cliHelper.writableStream("stderr");
        this.runners = {
            node: fakeRunner(this, "node"),
            browser: fakeRunner(this, "browser")
        };
        this.cli = testCli.create(this.stdout, this.stderr, {
            environmentVariable: "BUSTER_TEST_OPT",
            missionStatement: "Run Buster tests on a capture server",
            runners: this.runners
        });
        this.exit = this.cli.cli.exit = this.spy();
        cliHelper.cdFixtures();
    },

    tearDown: function (done) {
        cliHelper.clearFixtures(done);
    },

    "help": {
        "prints reporter help": function (done) {
            this.cli.run(["--help", "reporters"], done(function (err, cli) {
                assert.stdout("a set of built-in reporters");
            }));
        },

        "prints regular help": function (done) {
            this.cli.run(["--help"], done(function (err, cli) {
                assert.stdout("Run Buster tests");
            }));
        }
    },

    "configuration": {
        "recognizes --config option": function (done) {
            process.chdir(__dirname);
            this.cli.run(["--config", "file.js"], done(function (err, client) {
                var message = "-c/--config: file.js did not match any files";
                assert.stderr(message);
                assert.match(err.message, message);
            }.bind(this)));
        }
    },

    "explicit environment": {
        setUp: function () {
            cliHelper.writeFile("buster-buggy.js", "var config = module.exports;" +
                                "config.server = { environment: 'phonegap' }");
        },

        "fails when environment does not exist": function (done) {
            this.cli.run(["-c", "buster-buggy.js", "-e", "phonegap"], done(function () {
                assert.stderr("No runner for environment 'phonegap'.");
                assert.stderr("Try one of");
                assert.stderr("node");
                assert.stderr("browser");
            }));
        }
    },

    "node runs": {
        setUp: function () {
            cliHelper.writeFile("buster.js", "var config = module.exports;" +
                                "config.server = { environment: 'node' }");
        },

        "loads node runner": function (done) {
            this.cli.run([], done(function () {
                assert.calledOnce(this.runners.node.run);
                refute.equals(this.runners.node.run.thisValues[0], this.runners.node);
            }.bind(this)));
        },

        "provides runner with logger": function (done) {
            this.cli.run([], done(function () {
                assert.equals(this.cli.logger, this.runners.node.run.thisValues[0].logger);
            }.bind(this)));
        },

        "runs runner with config and options": function (done) {
            this.cli.run([], done(function () {
                assert.match(this.runners.node.run.args[0][1], { reporter: "dots" });
                assert.equals(this.runners.node.run.args[0][0].environment, "node");
            }.bind(this)));
        },

        "transfers filters to node runner": function (done) {
            this.cli.run(["should-"], done(function () {
                assert.equals(this.runners.node.run.args[0][1].filters, ["should-"]);
            }.bind(this)));
        },

        "fails if reporter does not exist": function (done) {
            this.cli.run(["-r", "bogus"], done(function () {
                assert.match(this.stderr, "No such reporter 'bogus'");
            }.bind(this)));
        }
    },

    "with preferences": {
        setUp: function () {
            this.preferences = { get: this.stub() };
            this.config = cliHelper.writeFile(
                "buster2.js", "var config = module.exports;" +
                    "config.server = { environment: 'browser' }");
            this.cli = testCli.create(this.stdout, this.stderr, {
                runners: this.runners,
                preferences: this.preferences
            });
            this.cli.cli.exit = this.spy();
        },

        "uses color preference": function (done) {
            this.preferences.get.withArgs("test.color").returns("none");

            this.cli.run(["-c", this.config], done(function () {
                assert.match(this.runners.browser.run.args[0][1], {
                    color: false
                });
            }.bind(this)));
        },

        "uses color option as default": function (done) {
            this.preferences.get.withArgs("test.color").returns("none");

            this.cli.run(["-c", this.config, "-C", "dim"], done(function () {
                assert.match(this.runners.browser.run.args[0][1], {
                    color: true,
                    bright: false
                });
            }.bind(this)));
        },

        "uses release console preference": function (done) {
            this.preferences.get.withArgs("test.releaseConsole").returns(true);

            this.cli.run(["-c", this.config], done(function () {
                assert.match(this.runners.browser.run.args[0][1], {
                    captureConsole: false
                });
            }.bind(this)));
        },

        "uses release console argument": function (done) {
            this.preferences.get.withArgs("test.releaseConsole").returns(false);

            this.cli.run(["-c", this.config, "--release-console"], done(function () {
                assert.match(this.runners.browser.run.args[0][1], {
                    captureConsole: false
                });
            }.bind(this)));
        },


        "uses log all preference": function (done) {
            this.preferences.get.withArgs("test.logAll").returns(true);

            this.cli.run(["-c", this.config], done(function () {
                assert.match(this.runners.browser.run.args[0][1], {
                    logPassedMessages: true
                });
            }.bind(this)));
        },

        "uses log all argument": function (done) {
            this.preferences.get.withArgs("test.logAll").returns(false);

            this.cli.run(["-c", this.config, "--log-all"], done(function () {
                assert.match(this.runners.browser.run.args[0][1], {
                    logPassedMessages: true
                });
            }.bind(this)));
        }
    },

    "browser runs": {
        setUp: function () {
            this.config = cliHelper.writeFile(
                "buster2.js", "var config = module.exports;" +
                    "config.server = { environment: 'browser' }");
        },

        "loads browser runner": function (done) {
            this.cli.run(["-c", this.config], done(function () {
                assert.calledOnce(this.runners.browser.run);
                refute.equals(this.runners.browser.run.thisValues[0], this.runners.browser);
            }.bind(this)));
        },

        "loads browser with server setting": testArgumentOption([], {
            server: "http://localhost:1111"
        }),

        "loads browser with specific server setting": testArgumentOption(
            ["-s", "127.0.0.1:1234"], {
                server: "http://127.0.0.1:1234"
            }
        ),

        "allows hostnameless server config": testArgumentOption(
            ["--server", "127.0.0.1:5678"], {
                server: "http://127.0.0.1:5678"
            }
        ),

        "allows full server url, including protocol": testArgumentOption(
            ["-s", "http://lol:1234"], {
                server: "http://lol:1234"
            }
        ),

        "skips caching": function (done) {
            var runner = { run: this.stub().yields() };
            this.stub(this.cli, "loadRunner").yields(null, runner);

            this.cli.run(["-c", this.config, "-R"], done(function () {
                refute(runner.cacheable);
            }.bind(this)));
        },

        "is cacheable by default": function (done) {
            var runner = { run: this.stub().yields() };
            this.stub(this.cli, "loadRunner").yields(null, runner);

            this.cli.run(["-c", this.config], done(function () {
                assert(runner.cacheable);
            }.bind(this)));
        },

        "sets warning level": testArgumentOption(
            ["-W", "all"], { warnings: "all" }
        ),

        "sets warning level with long option": testArgumentOption(
            ["--warnings", "warning"], { warnings: "warning" }
        ),

        "sets warning fail level": testArgumentOption(
            ["-F", "fatal"], { failOn: "fatal" }
        ),

        "sets warning fail level with long option": testArgumentOption(
            ["--fail-on", "error"], { failOn: "error" }
        ),

        "captures console by default": testArgumentOption(
            [], { captureConsole: true }
        ),

        "releases console": testArgumentOption(
            ["--release-console"], { captureConsole: false }
        ),

        "sets release console with short option": testArgumentOption(
            ["-o"], { captureConsole: false }
        ),

        "logs all messages": testArgumentOption(
            ["--log-all"], { logPassedMessages: true }
        ),

        "logs all messages with short option": testArgumentOption(
            ["-L"], { logPassedMessages: true }
        ),

        "sets static resource path": testArgumentOption(
            ["--static-paths"], { staticResourcePath: true }
        ),

        "sets static resource path with short option": testArgumentOption(
            ["-p"], { staticResourcePath: true }
        ),

        "transfers filters": testArgumentOption(
            ["//should-"], { filters: ["//should-"] }
        )
    },

    "analyzer": {
        setUp: function () {
            this.analyzer = buster.eventEmitter.create();
            this.analyzer.failOn = function () {};
            this.stub(analyzer, "create").returns(this.analyzer);

            this.runner = { run: this.stub(), abort: this.spy() };
            this.stub(this.cli, "loadRunner").yields(null, this.runner);
        },

        "prevents caching on warning": function () {
            this.cli.run(["-c", this.config]);
            this.analyzer.emit("warning", {});
            assert.isFalse(this.runner.cacheable);                
        },

        "prevents caching on error": function () {
            this.cli.run(["-c", this.config]);
            this.analyzer.emit("error", {});
            assert.isFalse(this.runner.cacheable);
        },

        "prevents caching on fatal": function () {
            this.cli.run(["-c", this.config]);
            this.analyzer.emit("fatal", {});
            assert.isFalse(this.runner.cacheable);
        },

        "aborts run if analyzer fails": function () {
            this.cli.run(["-c", this.config]);
            this.analyzer.emit("fail", { errors: 42 });
            assert.calledOnce(this.runner.abort);
            assert.match(this.runner.abort.args[0][0], {
                stats: { errors: 42 },
                type: "AnalyzerError",
                message: "Pre-condition failed"
            });
        },

        "calls callback when analyzer fails run": function () {
            var callback = this.spy();
            this.cli.run(["-c", this.config], callback);
            this.analyzer.emit("fail", { errors: 42 });
            assert.calledOnce(callback);
        },

        "only calls callback once": function () {
            var callback = this.spy();
            this.cli.run(["-c", this.config], callback);
            this.analyzer.emit("fail", { errors: 42 });
            this.runner.run.yield(null);
            assert.calledOnce(callback);
        },

        "only calls callback once when analyzer fails after run": function () {
            var callback = this.spy();
            this.cli.run(["-c", this.config], callback);
            this.runner.run.yield(null);
            this.analyzer.emit("fail", { errors: 42 });
            assert.calledOnce(callback);
        }
    },

    "configuration": {
        setUp: function () {
            this.busterOptBlank = typeof process.env.BUSTER_TEST_OPT != "string";
            this.busterOpt = process.env.BUSTER_TEST_OPT;
        },

        tearDown: function () {
            process.env.BUSTER_TEST_OPT = this.busterOpt;
            if (this.busterOptBlank) delete process.env.BUSTER_TEST_OPT;
        },

        "adds command-line options set with $BUSTER_TEST_OPT": function (done) {
            process.env.BUSTER_TEST_OPT = "--color dim -r specification";
            this.cli.run(["-c", this.config], done(function () {
                assert.match(this.runners.node.run.args[0][1], {
                    color: true,
                    bright: false,
                    reporter: "specification"
                });
            }.bind(this)));
        },

        "processes one group at a time": function () {
            var callback = this.spy();
            this.runners.fake = { run: this.spy() };
            this.cli.runConfigGroups([
                { environment: "fake", id: 1 },
                { environment: "fake", id: 2 }
            ], {}, callback);

            assert.calledOnce(this.runners.fake.run);
            refute.called(callback);
        },

        "processes next group when previous is done": function () {
            var callback = this.spy();
            this.runners.fake = { run: this.stub().yields() };
            this.cli.runConfigGroups([
                { environment: "fake", id: 1 },
                { environment: "fake", id: 2 }
            ], {}, callback);

            assert.calledTwice(this.runners.fake.run);
            assert.calledOnce(callback);
        }
    },

    "with --color option": {
        setUp: function () {
            this.config = cliHelper.writeFile(
                "buster2.js", "var config = module.exports;" +
                    "config.server = { environment: 'node' }");
        },

        "skips ansi escape sequences when set to none": function (done) {
            this.cli.run(["-c", this.config, "-C", "none"], done(function () {
                assert.match(this.runners.node.run.args[0][1], {
                    color: false,
                    bright: false
                });
            }.bind(this)));
        }
    },

    "exit code": {
        setUp: function () {
            this.done = this.spy();
            this.nextGroup = -1;
            this.runners.fake = {
                run: function (group, options, callback) {
                    this.nextGroup += 1;
                    callback.apply(null, this.results[this.nextGroup]);
                }.bind(this)
            };
        },

        "is 0 when single test configuration passes": function () {
            this.results = [[null, { ok: true }]];
            this.cli.runConfigGroups([{ environment: "fake" }], {}, this.done);
            assert.calledOnceWith(this.exit, 0);
        },

        "is 0 when two test configurations pass": function () {
            this.results = [[null, { ok: true }], [null, { ok: true }]];
            this.cli.runConfigGroups([{ environment: "fake" }, {
                environment: "fake"
            }], {}, this.done);
            assert.calledOnceWith(this.exit, 0);
        },

        "is 1 when single test configuration fails": function () {
            this.results = [[null, { ok: false }]];
            this.cli.runConfigGroups([{ environment: "fake" }], {}, this.done);
            assert.calledOnceWith(this.exit, 1);
        },

        "is 1 when one of several test configurations fails": function () {
            this.results = [[null, { ok: true }], [null, { ok: false }]];
            this.cli.runConfigGroups([{ environment: "fake" }, {
                environment: "fake"
            }], {}, this.done);
            assert.calledOnceWith(this.exit, 1);
        },

        "uses exception status code": function () {
            this.results = [[{ code: 13 }]];
            this.cli.runConfigGroups([{ environment: "fake" }], {}, this.done);
            assert.calledOnceWith(this.exit, 13);
        },

        "defaults error code to 70 (EX_SOFTWARE) for code-less exception": function () {
            this.results = [[{}]];
            this.cli.runConfigGroups([{ environment: "fake" }], {}, this.done);
            assert.calledOnceWith(this.exit, 70);
        },

        "fails for single failed configuration": function () {
            var ok = [null, { ok: true }];
            this.results = [ok, ok, [{ code: 99 }], ok];
            var group = { environment: "fake" };
            this.cli.runConfigGroups([group, group, group, group], {}, this.done);
            assert.calledOnceWith(this.exit, 99);
        }
    }
});
