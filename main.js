/**
 * Database visualization plugin for diagrams.net
 */
Draw.loadPlugin(function(ui) {
    console.log('Plugin initialized');
    console.log('UI object:', ui);
    console.log('Toolbar exists:', !!ui.toolbar);
    // Flag to track if SQL.js is loaded
    let sqlJsLoaded = false;
    let db = null;
    // Load SQL.js using mxscript
    mxscript(`C:/Users/Sam/AppData/Roaming/draw.io/plugins/sql-js-loader.js`, function() {
        console.log('SQL.js loaded successfully');
        sqlJsLoaded = true;
    }, null, null, true);

    console.log('Attempting to load SQL.js...');

    // Database operations functions
    async function loadAndQueryDatabase(file, sql, params = {}) {
        if (!sqlJsLoaded) {
            throw new Error('SQL.js is not loaded yet. Please try again in a moment.');
        }

        const reader = new FileReader();

        try {
            // Read file
            const arrayBuffer = await new Promise((resolve, reject) => {
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(reader.error);
                reader.readAsArrayBuffer(file);
            });

            // Create database instance using SQL.js
            const uints = new Uint8Array(arrayBuffer);
            db = new SQL.Database(uints);

            // get auxiliary infos
            const nodeDefQuery = "SELECT * FROM NodeDefinitions;"
            let stmt;
            const shape_dict = {};
            try {
                stmt = db.prepare(nodeDefQuery);
                Object.entries(params).forEach(([key, value]) => {
                    stmt.bind([value]);  // Note: v0.5.0 uses positional binding
                });

                const aux_rows = []
                // Collect all rows
                while (stmt.step()) {
                    aux_rows.push(stmt.getAsObject());
                }
                aux_rows.forEach((row, index) => {shape_dict[row.NodeType] = row.ShapeId;});

            } finally {
                if (stmt) stmt.free();
            }

            // Execute query with parameters
            try {
                stmt = db.prepare(sql);
                Object.entries(params).forEach(([key, value]) => {
                    stmt.bind([value]);  // Note: v0.5.0 uses positional binding
                });

                // Collect all rows
                const rows = [];
                while (stmt.step()) {
                    rows.push(stmt.getAsObject());
                }

                // Convert to graph format and create visualization
                const graphData = convertToGraphFormat(rows, shape_dict);
                createGraph(graphData);

            } finally {
                if (stmt) stmt.free();
            }

        } catch (error) {
            console.error('Database error:', error);
            throw error;
        }
    }

    // Helper function to find the nearest parent node
    function findNearestParent(currentNodeId, rows, shape_dict) {
        // Start from current node and move backwards
        for (let i = currentNodeId - 1; i >= 0; i--) {
            const potentialParent = rows.find(row => row.NodeId === i);
            if (potentialParent && shape_dict[potentialParent.NodeType] !== 1) {
                return potentialParent.NodeId;
            }
        }
        return null;
    }

    // Helper function to check if a node is a target of any JumpTo
    function isJumpToTarget(nodeId, rows) {
        return rows.some(row => row.JumpTo === nodeId);
    }

    function convertToGraphFormat(rows, shape_dict) {
        console.log('Creating nodes...');
        const nodes = rows.map((row, index) => {
            const nodeId = row.NodeId;
            console.log(`Node ${index}: ID = ${nodeId}`, row);
            return {
                id: nodeId?.toString(),
                label: `${row.NodeId}\n${row.NodeType}`,
                shape: shape_dict[row.NodeType] === 0 ? 'circle' : 'square'  // Add shape property
            };
        });
        const lastNodeId = rows.length;
        const endNode = {
            id: lastNodeId,
            label: 'End',
            shape: 'square'  // Default shape for end node
        };
        console.log(endNode.id)
        nodes.push(endNode);

        // Create edges with logging
        console.log('\nCreating edges...');
        const edges = [];
        rows.forEach(row => {
            if (row?.JumpTo) {
                // Handle explicit JumpTo connections
                console.log(`JumpTo Edge: ${row.NodeId} --> ${row.JumpTo}`);
                edges.push({
                    source: row.NodeId.toString(),
                    target: row.JumpTo.toString()
                });
            }

            // If current node's shape is not 1, it should connect to next node
            if (shape_dict[row.NodeType] !== 1) {
                const nextNodeId = Number(row.NodeId) + 1;
                if (nextNodeId < rows.length) {
                    console.log(`Sequential Edge: ${row.NodeId} --> ${nextNodeId}`);
                    edges.push({
                        source: row.NodeId.toString(),
                        target: nextNodeId.toString()
                    });
                }
            }

            // For nodes that aren't targets of JumpTo, find their parent
            if (!isJumpToTarget(row.NodeId, rows)) {
                const parentId = findNearestParent(row.NodeId, rows, shape_dict);
                if (parentId !== null && parentId !== row.NodeId) {
                    console.log(`Parent Edge: ${parentId} --> ${row.NodeId}`);
                    edges.push({
                        source: parentId.toString(),
                        target: row.NodeId.toString()
                    });
                }
            }
        });

        // Remove any duplicate edges
        const uniqueEdges = edges.filter((edge, index, self) =>
            index === self.findIndex(e =>
                e.source === edge.source && e.target === edge.target
            )
        );

        console.log('\nFinal count:', {
            totalNodes: nodes.length,
            totalEdges: edges.length
        });

        return { nodes, edges };
    }

    function createGraph(data) {
        var graph = ui.editor.graph;
        var parent = graph.getDefaultParent();

        graph.getModel().beginUpdate();
        try {
            // Clear existing graph
            graph.removeCells(graph.getChildCells(parent));

            // Create vertices
            var vertices = {};
            data.nodes.forEach(function(node) {
                var style = 'shape=';
                if (node.shape === 'circle') {
                    style += 'ellipse';  // Use ellipse for circular nodes
                } else {
                    style += 'rectangle';  // Use rectangle for square nodes
                }
                // Adjust dimensions based on shape
                var width = 120;
                var height = node.shape === 'circle' ? 120 : 60;  // Make circles have equal width and height

                var vertex = graph.insertVertex(
                    parent,
                    node.id,
                    node.label,
                    Math.random() * 400,
                    Math.random() * 400,
                    width,
                    height,
                    style
                );
                console.log(`inserting node: ${node.id} to ${vertex}`)
                vertices[node.id] = vertex;
            });

            // Create edges
            data.edges.forEach(function(edge) {
                console.log(`From ${edge.source} to ${edge.target}`)
                console.log(`Simply put: ${vertices[edge.source]} to ${vertices[edge.target]}`)
                if (vertices[edge.source] && vertices[edge.target]) {
                    graph.insertEdge(
                        parent,
                        null,
                        '',
                        vertices[edge.source],
                        vertices[edge.target]
                    );
                }
            });

            // Apply automatic layout
            var layout = new mxHierarchicalLayout(graph);
            layout.execute(parent);
        } finally {
            graph.getModel().endUpdate();
        }
    }

    // Custom dialog class
    function CustomDialog(ui, content, okFn, cancelFn, btnText) {
        console.log('Attempting to create dialog class...');
        var div = document.createElement('div');
        div.style.padding = '10px';

        // Add content
        div.appendChild(content);

        // Add buttons
        var btns = document.createElement('div');
        btns.style.marginTop = '16px';
        btns.style.textAlign = 'right';

        if (okFn) {
            var okBtn = mxUtils.button(btnText || 'OK', function() {
                ui.hideDialog();
                if (okFn) {
                    okFn();
                }
            });
            btns.appendChild(okBtn);
        }

        if (cancelFn) {
            var cancelBtn = mxUtils.button('Cancel', function() {
                ui.hideDialog();
                if (cancelFn) {
                    cancelFn();
                }
            });

            if (okFn) {
                cancelBtn.style.marginLeft = '10px';
            }

            btns.appendChild(cancelBtn);
        }

        div.appendChild(btns);

        this.container = div;
    }

    // Register UI Actions immediately
    console.log('Attempting to register ui actions...');
    ui.actions.addAction('loadDatabase', function() {
        var width = 500;
        var height = 400;

        var div = document.createElement('div');
        div.style.padding = '20px';

        // File input for database
        var fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.db,.sqlite,.sqlite3';
        fileInput.style.marginBottom = '20px';
        div.appendChild(fileInput);

        // SQL query input
        var queryLabel = document.createElement('div');
        mxUtils.write(queryLabel, 'SQL Query:');
        queryLabel.style.marginBottom = '8px';
        div.appendChild(queryLabel);

        var queryInput = document.createElement('textarea');
        queryInput.style.width = '100%';
        queryInput.style.height = '100px';
        queryInput.style.marginBottom = '20px';
        queryInput.value = "SELECT * FROM BehaviorTreeNodes WHERE TreeName = 'Settle New Town'";
        div.appendChild(queryInput);

        // Parameter input
        var paramLabel = document.createElement('div');
        mxUtils.write(paramLabel, 'Parameters (JSON format, optional):');
        paramLabel.style.marginBottom = '8px';
        div.appendChild(paramLabel);

        var paramInput = document.createElement('textarea');
        paramInput.style.width = '100%';
        paramInput.style.height = '60px';
        paramInput.value = '{}';
        div.appendChild(paramInput);

        var dlg = new CustomDialog(
            ui,
            div,
            async function() {
                if (fileInput.files.length === 0) {
                    alert('Please select a database file');
                    return;
                }

                try {
                    await loadAndQueryDatabase(
                        fileInput.files[0],
                        queryInput.value,
                        JSON.parse(paramInput.value)
                    );
                } catch (error) {
                    alert('Error: ' + error.message);
                    console.error(error);
                }
            },
            null,
            'Load Database'
        );

        ui.showDialog(dlg.container, width, height, true, true);
    }, null, null, 'Load Database');

    console.log('Attempting to add capture state function...');
    ui.actions.addAction('captureState', function() {
        var graph = ui.editor.graph;
        var model = graph.getModel();
        var parent = graph.getDefaultParent();
        var vertices = {};
        var edges = [];

        var childCount = model.getChildCount(parent);

        for (var i = 0; i < childCount; i++) {
            var cell = model.getChildAt(parent, i);

            if (cell.isVertex()) {
                vertices[cell.id] = {
                    id: cell.id,
                    label: cell.value,
                    x: cell.geometry.x,
                    y: cell.geometry.y
                };
            } else if (cell.isEdge()) {
                edges.push({
                    source: cell.source.id,
                    target: cell.target.id
                });
            }
        }

        var result = {
            vertices: vertices,
            edges: edges
        };

        var width = 600;
        var height = 400;

        var div = document.createElement('div');
        div.style.padding = '20px';

        var pre = document.createElement('pre');
        pre.style.maxHeight = '300px';
        pre.style.overflow = 'auto';
        pre.style.whiteSpace = 'pre-wrap';
        pre.textContent = JSON.stringify(result, null, 2);

        div.appendChild(pre);

        var dlg = new CustomDialog(
            ui,
            div,
            null,
            null,
            'Captured Graph State'
        );

        ui.showDialog(dlg.container, width, height, true, true);
    }, null, null, 'Capture State');

    console.log('Adding toolbar buttons...');

    // Create action cells for the buttons
    var loadDatabaseAction = ui.actions.get('loadDatabase');
    var captureStateAction = ui.actions.get('captureState');

    // Add the items to the toolbar
    var tbContainer = ui.toolbar.container;
    console.log('Toolbar container:', tbContainer);

    // Create a new toolbar item
    var toolbarItems = ui.toolbar.addItems(['loadDatabase', 'captureState']);
    console.log('Toolbar items created:', toolbarItems);

    // Add a separator between existing buttons and our new ones
    ui.toolbar.addSeparator();

    // Create the actual buttons with images
    var loadDbButton = ui.toolbar.addButton('insertIcon', 'Load Database', function() {
        loadDatabaseAction.funct();
    });
    loadDbButton.innerHTML = '<div class="geAdaptiveAsset" style="background-image: url(&quot;data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGhlaWdodD0iMjRweCIgdmlld0JveD0iMCAtOTYwIDk2MCA5NjAiIHdpZHRoPSIyNHB4IiBmaWxsPSIjMDAwMDAwIj48cGF0aCBkPSJNNzg0LTEyMCA1MzItMzcycS0zMCAyNC02OSAzOHQtODMgMTRxLTEwOSAwLTE4NC41LTc1LjVUMTIwLTU4MHEwLTEwOSA3NS41LTE4NC41VDM4MC04NDBxMTA5IDAgMTg0LjUgNzUuNVQ2NDAtNTgwcTAgNDQtMTQgODN0LTM4IDY5bDI1MiAyNTItNTYgNTZaTTM4MC00MDBxNzUgMCAxMjcuNS01Mi41VDU2MC01ODBxMC03NS01Mi41LTEyNy41VDM4MC03NjBxLTc1IDAtMTI3LjUgNTIuNVQyMDAtNTgwcTAgNzUgNTIuNSAxMjcuNVQzODAtNDAwWm0tNDAtNjB2LTgwaC04MHYtODBoODB2LTgwaDgwdjgwaDgwdjgwaC04MHY4MGgtODBaIi8+PC9zdmc+&quot;); background-position: center center; background-repeat: no-repeat; background-size: 18px; width: 22px; height: 20px;"></div>';

    var captureButton = ui.toolbar.addButton('insertIcon', 'Capture State', function() {
        captureStateAction.funct();
    });
    captureButton.innerHTML = '<div class="geAdaptiveAsset" style="background-image: url(&quot;data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGhlaWdodD0iMjRweCIgdmlld0JveD0iMCAtOTYwIDk2MCA5NjAiIHdpZHRoPSIyNHB4IiBmaWxsPSIjMDAwMDAwIj48cGF0aCBkPSJNNzg0LTEyMCA1MzItMzcycS0zMCAyNC02OSAzOHQtODMgMTRxLTEwOSAwLTE4NC41LTc1LjVUMTIwLTU4MHEwLTEwOSA3NS41LTE4NC41VDM4MC04NDBxMTA5IDAgMTg0LjUgNzUuNVQ2NDAtNTgwcTAgNDQtMTQgODN0LTM4IDY5bDI1MiAyNTItNTYgNTZaTTM4MC00MDBxNzUgMCAxMjcuNS01Mi41VDU2MC01ODBxMC03NS01Mi41LTEyNy41VDM4MC03NjBxLTc1IDAtMTI3LjUgNTIuNVQyMDAtNTgwcTAgNzUgNTIuNSAxMjcuNVQzODAtNDAwWm0tNDAtNjB2LTgwaC04MHYtODBoODB2LTgwaDgwdjgwaDgwdjgwaC04MHY4MGgtODBaIi8+PC9zdmc+&quot;); background-position: center center; background-repeat: no-repeat; background-size: 18px; width: 22px; height: 20px;"></div>';

    console.log('Buttons created:', loadDbButton, captureButton);
});