function loadFromGist(gistID, successCallback, errorCallback) {
    // Download the files from the gist asynchronously
    $.ajax({
        url: 'https://api.github.com/gists/' + gistID,
        type: 'get',
        dataType: 'json',
        cache: true,
        success: handleGist,
        async: true,
        error: errorCallback
    });
        
    /**
     * When a gist is received
     * @param data the descriptions of each file in the gist
     */
    function handleGist(data) {
        // Extract each of the files in the gist
        cspFiles = Object.keys(data.files)
            .map((key) => {
                    return {filename: key, contents: data.files[key].content};            
                })
            .filter((gistFile) => {
                    return gistFile.filename.toLowerCase().endsWith(".csp") &&
                           !gistFile.filename.toLowerCase().startsWith("sol");
                });
        
        //console.log("handle:", cspFiles);
        successCallback(cspFiles);
    }
}