/*
 * The gitHub API Singleton
 * @type gitHubAPI
 */
/* global hello */

var gitHub = {};

/*
 * Make sure that github is logged in before calling callback
 * if there is an error, call errorCallback with an error param
 *
 * @param {callback()} callback             The function to run once logged in
 * @param {callback(error)} errorCallback   The function to call if there is an
 *                                          error logging in
 * @returns {undefined}
 */
gitHub.ensureLogin = function (callback, errorCallback) {
    // Determine if there is a current oauth session
    var session = hello('github').getAuthResponse();
    var currentTime = (new Date()).getTime() / 1000;
    var online = session && session.access_token && session.expires > currentTime;

    if (online) {
        // If there is an active session, perform the callback
        callback();
    } else {
        // Otherwise, login
        var options = {};
        options.scope = ['user', 'repo', 'gist'];
        options.force = false;
        
        gitHub.successCallback = callback;
        
        hello('github', options).login().then(function () {
            
        },
        function (e) {
            // If there was an error, send it to the callback 
            errorCallback(e);
        });
    }
};

/*
 * Download a repo from GitHub
 *
 * @param {type} fullName       The full name (path) of the GitHub repo
 * @param {type} fileManager    The FileManager to load the repo into
 * @param {type} main           The name of the file to make 'main' for the 
 *                              project
 * @returns {undefined}
 */
gitHub.getRepo = function (fullName, fileManager, main) {
    gitHub.ensureLogin(function () {
        hello('github').api('/repos/' + fullName).then(function (data) {
            var repo = gitHub.repoFromData(data);
            gitHub.loadRepo(fileManager, repo, main);
        },
        function (e) {
            alert("Could not load + " + fullName + ": " + e.error.message);
        });
    },
    function (e) {
        alert("Could not access " + fullName + ": " + e.error.message);
    });
};

/*
 * Get all of the user's repositories
 * 
 * @param {callback(repo[])} done Callback to receive repo list
 * @param {callback(error)} error Callback to receive error object
 * @returns {undefined}
 */
gitHub.getRepos = function (done, error) {
    /*
     * Handle a repo response from GitHub
     */
    var addAllRepos = function (target, json, done, error) {
        // Add all returned repos to the list
        json.data.forEach(function (data) {
            target.push(gitHub.repoFromData(data));
        });

        // If there are more pages of repos,
        if (json.paging && json.paging.next) {
            // Request the next page of repos
            hello('github').api(json.paging.next).then(
                    function (response) {
                        console.log("retrieving next page of repos...");
                        // and handle the repos
                        addAllRepos(target, response, done, error);
                    },
                    function (e) {
                        // If there is an error, report it
                        error(e);
                    });
        } else {
            // If there are no more pages of repos, send them to the caller
            done(target);
        }
    };

    // Clear out the list of repos
    gitHub.repos = [];

    // Make sure that the user is logged in
    gitHub.ensureLogin(function () {
        // Then request the user's repos
        hello('github').api(gitHub.repos_url + "?type=all").then(
                function (response) {
                    // Once the repos are received, add them to the repo list
                    addAllRepos(gitHub.repos, response, done, error);
                },
                function (e) {
                    // If there was an error, report it
                    error(e);
                });
    },
            function (e) {
                // If there was an error logging in, report it
                error(e);
            });
};

/*
 * Make a repo object from a GitHub Repo JSON description
 *
 * @param {JSON Data} data the GitHub JSON description of a repository
 * @returns {gitHub.repoFromData.repo}
 */
gitHub.repoFromData = function (data) {
    /*
     * A repository description
     * @type repo
     */
    var repo = {};
    repo.id = data.id;
    repo.owner = data.owner.login;
    repo.name = data.name;
    repo.full_name = data.full_name;
    repo.description = data.description;
    repo.url = data.url;
    repo.branches_url = data.branches_url;
    repo.git_commits_url = data.git_commits_url;
    repo.default_branch = data.default_branch;
    repo.permissions = data.permissions;
    return repo;
};

/*
 * Load the files from a github repo into a FileManager
 * 
 * @param {FileManager} fileManager A reference for the FileManager to load 
 *                                  the repo into
 * @param {Repo} repo   A repository object describing the repo to load
 * @param {String} main The name of the file to make the 'main' file of the 
 *                      project
 * @returns {undefined}
 */
gitHub.loadRepo = function (fileManager, repo, main) {
    // Construct the url for the repo's default branch
    var branch = repo.branches_url.replace(/\{.*\}/, "/" + repo.default_branch);
    
    // Download the files from the branch
    hello('github').api(branch).then(function (response) {
        // Clear out the file manager
        fileManager.empty();
        var folder = fileManager.getRootFolder();
        
        // Load the repository into the file manager's root folder
        gitHub.loadTree(folder, response.commit.commit.tree.url, fileManager, main);
        gitHub.openRepo = repo;
    },
    function (e) {
        alert('Error loading Repo branch: ' + e.error.message);
    });
};

/*
 * Load a repository file tree from GitHub into a folder
 * 
 * @param {Folder} folder
 * @param {URL} tree
 * @param {FileManager} fileManager
 * @param {String} main
 * @returns {undefined}
 */
gitHub.loadTree = function (folder, tree, fileManager, main) {
    // Load the item descriptions contained in the tree
    hello('github').api(tree).then(function (response) {
        // For each item in this tree
        response.tree.forEach(function (item) {
            // If the item is a subtree
            if (item.type === "tree") {
                // Create a subfolder and load the subtree into it
                var subFolder = new Folder(item.path, folder);
                subFolder.sha = item.sha;
                folder.addFolder(subFolder);
                gitHub.loadTree(subFolder, item.url, fileManager, main);

                fileManager.updateDisplay();
            // If the item is a file
            } else if (item.type === "blob") {
                // load the file into this folder
                gitHub.loadFile(folder, item.path, item.url, fileManager, main);
            }
        });

        // If there are more pages of items in the tree,
        if (response.paging && response.paging.next) {
            gitHub.loadTree(folder, response.paging.next, fileManager, main);
        }
    },
    function (e) {
        alert("Error loading tree: " + e.error.message);
    });
};

/*
 * Load a file from GitHub into a folder
 * 
 * @param {Folder} folder   The folder to load the file into
 * @param {String} name     The name of the file
 * @param {URL} url         The url for the file data
 * @param {FileManager} fileManager The FileManager holding this file
 * @param {String} main     The name of the project's main file
 * @returns {undefined}
 */
gitHub.loadFile = function (folder, name, url, fileManager, main) {
    // Download the file contents
    hello('github').api(url).then(function (response) {
        // GitHub blobs are base64 encoded... decode the contents
        var content = window.atob(response.content);

        // Create a new file and add it to the folder
        var file = new SourceFile(name, content);
        
        file.sha = response.sha;
        
        folder.addFile(file);

        // check if a main method was specified
        if (main === null) {
            // if not, check if the file has a main method
            var isMain = /(public\s+static|static\s+public)\s+void\s+main\s*\(\s*String\s*\[\]/;
            if (isMain.test(file.contents)) {
                // Set the main file if it does
                fileManager.setMainFile(file);
                fileManager.setCurrentFile(file);
                console.log('No main class specified. ' + file.name + ' chosen.');
            }
        // If this file matches the main filename
        } else if (main === name) {
            // Make this file the main file
            fileManager.setMainFile(file);
            fileManager.setCurrentFile(file);
            console.log('Main file set: ' + name);
        }

        fileManager.updateDisplay();
    },
    function (e) {
        alert("Error loading file: " + e.error.message);
    });
};

/*
 * Save the open repository
 * @returns {undefined}
 */
gitHub.saveRepo = function(fileManager) {
    //console.log(gitHub.openRepo);
    
    // Build a tree with only the changed files
    var fileTree = gitHub.buildTree(fileManager.getRootFolder());
    //gitHub.pruneTree(fileTree);
    console.log(fileTree);
};

/*
 * 
 * @param {Folder} folder
 * @returns {unresolved}
 */

gitHub.buildTree = function(folder, name) {
    var tree = {};
    tree.tree = [];
    tree.name = name;
    
    folder.folders.forEach(function (subFolder) {
        tree.tree.push(gitHub.buildTree(subFolder, subFolder.name));
    });
    
    folder.files.forEach(function(file) {
        var treeFile = {};
        if (file.changed) {
            treeFile.changed = file.changed;
        }
        
        treeFile.contents = file.contents;
        treeFile.name = file.name;
        
        tree.tree.push(treeFile);
    });
    
    return tree;
};

/*
 * Callback for auth session starts
 */
gitHub.sessionStart = function() {
    hello('github').api('/me').then(function (json) {
        gitHub.username = json.login;
        gitHub.repos_url = json.repos_url;
        
        if (gitHub.successCallback) {
            var cb = gitHub.successCallback;
            gitHub.successCallback = null;
            cb();
        }
    },
    function (e) {

    });
}

/*
 * Prepare for oauth login to github
 */
hello.init({github: 'b80ec7eaa799156bba33'},
        {redirect_uri: 'https://run.mycode.run/redirect.html',
            oauth_proxy: 'https://auth-server.herokuapp.com/proxy'});

hello.on('auth.login', gitHub.sessionStart);