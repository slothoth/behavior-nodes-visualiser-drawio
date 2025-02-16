from graphviz import Source

TREE = 'Minor Power Assault'
tree = TREE.replace(' ', '_')
# Read the existing DOT file
with open(f'{tree}.dot', 'r') as f:
    dot_graph = f.read()

# Create a Source object
graph = Source(dot_graph)

# Render the graph
# This will create both a .pdf and .pdf.png file
graph.render(tree, view=True)  # Set view=True to automatically open the result

# If you want just PNG format:
graph.render(tree, format='png', view=True)