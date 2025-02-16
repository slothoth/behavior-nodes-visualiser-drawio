import sqlite3
from sys import platform
from typing import Dict, List, Tuple, Any
import textwrap
import getpass
import os

user = getpass.getuser()

if platform.lower() == "windows":
    DB_PATH = f"C:/Users/{user}/AppData/Local/Firaxis Games/Sid Meier's Civilization VII/Debug/gameplay-copy.sqlite"

if platform.lower() == "darwin":
    DB_PATH = f"/Users/{user}/Library/Application Support/Civilization VII/Debug/gameplay-copy.sqlite"

if platform.lower() == "linux":
    raise(OSError("I have no idea where your debugGameplay db will be stored, but you use Linux, I got faith in you sorting it out"))

if not os.path.exists(DB_PATH):
    raise(Exception("Can't find where your debug db is. Please edit this script with the 'DB_PATH = $yourfilepath' at the top of this file below DO_KEY where yours is."))

TREE = 'Minor Power Assault'
DO_KEY = True
class BehaviorTreeGraphGenerator:
    def __init__(self, db_path: str, tree: str):
        """Initialize the graph generator with database path."""
        self.db_path = db_path
        self.tree = tree
        self.node_def_descriptions = {}
        self.nodetype_counts = {}

    def load_and_query_database(self) -> Tuple[List[Dict[str, Any]], Dict[str, int]]:
        """Load the database and execute queries to get node data and shape definitions."""
        with sqlite3.connect(self.db_path) as conn:
            # Get shape definitions
            node_def_query = "SELECT * FROM NodeDefinitions;"
            aux_rows = conn.execute(node_def_query).fetchall()
            column_names = [description[0] for description in conn.execute(node_def_query).description]

            # Create shape dictionary
            shape_dict = { row[column_names.index('NodeType')]: row[column_names.index('ShapeId')]
                            for row in aux_rows}
            node_def_data = get_sql_dict(conn, node_def_query)
            self.node_def_descriptions = {i['NodeType']: i['Description'] for i in node_def_data}

            # Get TreeData
            query = "SELECT * FROM TreeData WHERE TreeName = '" + self.tree + "';"
            full_rows = get_sql_dict(conn, query)
            tree_data_dict = {}
            for row in full_rows:
                if row['NodeId'] not in tree_data_dict:
                    tree_data_dict[row['NodeId']] = {}
                tree_data_dict[row['NodeId']][row['DefnId']] = {'Default Data': row['DefaultData'], 'Tag': row['Tag']}

            # Get behavior tree nodes
            query = "SELECT * FROM BehaviorTreeNodes WHERE TreeName = '" + self.tree + "';"
            nodes_data = get_sql_dict(conn, query)

            for i in nodes_data:
                shape = shape_dict[i['NodeType']]
                i['shape'] = shape

            # we need NodeDataDefinitions too, for DataName, DataType, possibly Output, RequiredGroup, Tagged, UserData

            # we use the defnID and the NodeType

            unique_node_types = list(set(i['NodeType'] for i in nodes_data))

            for d in nodes_data:
                value = d['NodeType']
                self.nodetype_counts[value] = self.nodetype_counts.get(value, 0) + 1


            unique_node_dict = {}
            for i in unique_node_types:
                data_info = get_sql_dict(conn, "SELECT * FROM NodeDataDefinitions WHERE NodeType = '" + i + "';")
                unique_node_dict[i] = []
                for j in data_info:
                    unique_node_dict[i].append(j)

            combined_node_data = []
            for i in nodes_data:
                if i['NodeId'] in tree_data_dict:
                    i['subdefs'] = []
                    idx = 0
                    for key, j in tree_data_dict[i['NodeId']].items():
                        node_def_infos = unique_node_dict[i['NodeType']][idx]
                        def_info = {}
                        def_info['data_name'] = node_def_infos['DataName']
                        def_info['data_type'] = node_def_infos['DataType']
                        if j['Default Data'] is not None:
                            def_info['default_data'] = j['Default Data']
                        if j['Tag'] is not None:
                            def_info['Tag'] = j['Tag']
                        i['subdefs'].append(def_info)
                        idx += 1
                    combined_node_data.append(i)
                else:
                    combined_node_data.append(i)

            return combined_node_data

    def find_nearest_parent(self, current_node_id: int, rows: List[Dict[str, Any]]) -> int:
        """Find the nearest parent node for the current node."""
        for i in range(current_node_id - 1, -1, -1):
            potential_parent = next(
                (row for row in rows if row['NodeId'] == i), None
            )
            if (potential_parent and
                    potential_parent['shape'] not in [1, 2]):
                return potential_parent['NodeId']
        return None

    def node_description(self, node_type, key_jobs, key_index, node_def):
        fmt_lines = textwrap.fill(self.node_def_descriptions[node_type], width=30)
        if DO_KEY and self.nodetype_counts[node_type] > 2:
            if node_type not in key_jobs:
                label = f'{node_type}:\n {fmt_lines}'
                key_jobs[node_type] = f'    {key_index} [label="{label}", shape=box, style=filled, fillcolor=orange];'
                key_index += 1
        else:
            node_def += f'{fmt_lines}\n'
        return node_def, key_index, key_jobs

    def is_jump_to_target(self, node_id: int, rows: List[Dict[str, Any]]) -> bool:
        """Check if a node is a target of any JumpTo."""
        return any(row['JumpTo'] == node_id for row in rows if 'JumpTo' in row)

    def generate_dot_file(self, rows: List[Dict[str, Any]], output_path: str):
        """Generate a DOT file representation of the behavior tree."""
        dot_content = ['digraph BehaviorTree {']
        dot_content.append('    // Graph settings')
        dot_content.append('    rankdir=TB;')
        dot_content.append('    node [fontname="Arial"];')
        dot_content.append('    edge [fontname="Arial"];')
        dot_content.append('')

        # Add nodes
        dot_content.append('    // Nodes')

        key_jobs = {}
        key_index = len(rows) + 1
        for row in rows:
            node_id = str(row['NodeId'])
            node_type = row['NodeType']
            shape = 'circle' if row['shape'] == 0 else 'box'            # ironically, shape here is not about diagram, but num of edges on node possible
            style = 'filled'
            fillcolor = 'lightblue' if shape == 'circle' else 'lightgreen'
            label = node_id
            if 'subdefs' not in row:
                label += f': {node_type}\n'
                label, key_index, key_jobs = self.node_description(node_type, key_jobs, key_index, label)
            else:
                label += f': {node_type}\\n'
                label, key_index, key_jobs = self.node_description(node_type, key_jobs, key_index, label)
                for i in row['subdefs']:
                    label += f"{i['data_name']}:\\l"
                    for key, val in i.items():
                        if key == 'data_name':
                            continue
                        label += f'{key} : {val}\\l'
                    label += '\\n'
            node_def = f'    {node_id} [label = "{label}", shape="{shape}", style={style}, fillcolor={fillcolor}];'
            dot_content.append(node_def)

        # Add end node
        last_node_id = str(len(rows))
        dot_content.append(f'    {last_node_id} [label="End", shape=box, '
                           'style=filled, fillcolor=lightgreen];')

        dot_content.append('    // Keys')
        for val in key_jobs.values():
            dot_content.append(val)

        dot_content.append('')
        dot_content.append('    // Edges')



        # Add edges
        for row in rows:
            current_id = str(row['NodeId'])

            # Handle JumpTo connections
            if 'JumpTo' in row and row['JumpTo'] != 0:
                target = str(row['JumpTo'])
                dot_content.append(f'    {current_id} -> {target} [color=blue];')

            # Handle sequential connections
            if row['shape'] not in [1, 2]:
                next_id = str(int(current_id) + 1)
                if int(next_id) < len(rows):
                    dot_content.append(f'    {current_id} -> {next_id} [color=black];')

            # Handle parent connections
            if not self.is_jump_to_target(row['NodeId'], rows):
                parent_id = self.find_nearest_parent(row['NodeId'], rows)
                if parent_id is not None and parent_id != row['NodeId']:
                    if f'    {parent_id} -> {current_id} [color=black];' not in dot_content:
                        dot_content.append(f'    {parent_id} -> {current_id} [color=red];')

        dot_content.append('}')

        # Write to file
        with open(output_path, 'w') as f:
            f.write('\n'.join(dot_content))

        print(f"DOT file generated at: {output_path}")


def main():
    output_path = f"{TREE.replace(' ', '_')}.dot"
    generator = BehaviorTreeGraphGenerator(DB_PATH, TREE)

    # Load data from database
    combined_node_data = generator.load_and_query_database()

    # Generate DOT file
    generator.generate_dot_file(combined_node_data, output_path)



def get_sql_dict(conn, nodes_query):

    rows = conn.execute(nodes_query).fetchall()
    column_names = [description[0] for description in conn.execute(nodes_query).description]

    # Convert rows to list of dictionaries
    data_dict = [
        {column_names[i]: value for i, value in enumerate(row)}
        for row in rows
    ]
    return data_dict


if __name__ == "__main__":
    main()
