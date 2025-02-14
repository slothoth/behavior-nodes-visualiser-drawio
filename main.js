/**
 * Test version of database visualization plugin for diagrams.net
 */
Draw.loadPlugin(function(ui) {
    // Test data
    const TEST_DATA = {
        nodes: [
            { id: "1", label: "User" },
            { id: "2", label: "Order" },
            { id: "3", label: "Product" },
            { id: "4", label: "Category" },
            { id: "5", label: "Supplier" }
        ],
        edges: [
            { source: "1", target: "2" },  // User -> Order
            { source: "2", target: "3" },  // Order -> Product
            { source: "3", target: "4" },  // Product -> Category
            { source: "3", target: "5" },  // Product -> Supplier
            { source: "5", target: "4" }   // Supplier -> Category
        ]
    };

    // Add menu items
    ui.actions.addAction('loadTestData', function() {
        // Create and show confirmation dialog
        var width = 400;
        var height = 120;

        var div = document.createElement('div');
        div.style.textAlign = 'center';
        div.style.padding = '20px';

        mxUtils.write(div, 'This will load sample data representing a simple e-commerce database schema.');

        var dlg = new CustomDialog(
            ui,
            div,
            function() {
                // OK button handler
                createGraph(TEST_DATA);
            },
            null,
            'Load Test Data',
            function() {
                // Close button handler (optional)
            }
        );

        ui.showDialog(dlg.container, width, height, true, true);
    }, null, null, 'Load Test Data');

    // Add save button to verify graph state capture
    ui.actions.addAction('captureState', function() {
        // Get current graph state
        var graph = ui.editor.graph;
        var model = graph.getModel();
        var parent = graph.getDefaultParent();
        var vertices = {};
        var edges = [];

        // Traverse all cells
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

        // Create result object
        var result = {
            vertices: vertices,
            edges: edges
        };

        // Show state in dialog
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

    // Add toolbar buttons
    ui.toolbar.addSeparator();
    ui.toolbar.addButton('loadTestData', 'Load Test Data', function() {
        ui.actions.get('loadTestData').funct();
    });
    ui.toolbar.addButton('captureState', 'Capture State', function() {
        ui.actions.get('captureState').funct();
    });

    // Function to create graph from data
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
                var vertex = graph.insertVertex(
                    parent,
                    node.id,
                    node.label,
                    Math.random() * 400,
                    Math.random() * 400,
                    80,
                    30
                );
                vertices[node.id] = vertex;
            });

            // Create edges
            data.edges.forEach(function(edge) {
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
    function CustomDialog(ui, content, okFn, cancelFn, btnText, closeFn) {
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

    // Add test function to window for console testing
    window.testPlugin = {
        loadData: function() {
            createGraph(TEST_DATA);
        },
        captureState: function() {
            ui.actions.get('captureState').funct();
        }
    };
});