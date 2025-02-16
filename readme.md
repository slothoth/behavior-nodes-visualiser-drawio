# About

This is a python script used to generate behaviour trees using the GraphViz format. It uses your gameplay-copy.sqlite generated
on launching into a game once you alter your AppOptions.txt in C:\Users\$USERNAME\AppData\Local\Firaxis Games\Sid Meier's Civilization VII 
to generate the debug db files.

# Installation
To install, click the green tab marked Code on the homepage, then Download Zip. Unzip the downloaded file from this github page.
You will need a python installation, I developed this on python 3.9, but it barely uses any libraries and is quite simple,
it should work on any python that has f-strings.
To use it, you just need to run main.py. You can edit the script at the top to set a variable, TREE, which 
determines which BehaviourTree to visualise. It should generate a file with the name of the tree with the dot extension.
You can copy the contents of that file into any graphviz editor, or you can use:

pip install graphviz

and run graphviz_viz.py to generate it yourself.

# Future Development

A major feature i plan to implement is generating SQL code against the DB according to a tree node layout the user has 
defined. As I changed the implementation to python and graphviz, i am looking for a good GUI editor i can slot my graphviz into.
But i suspect there will be something.

Currently the algorithm to build the tree is to generate all the nodes, then make edges where a JumpTo exists, and where
a node is otherwise parentless, walk backwards in the NodeId to find the first node with a shapeId that is not 1, which
seems to indicate a leaf node. If you are knowledgeable in this department, and notice a mistake or an oversight, please
contact me, as i built it using roughly guesswork and someone elses diagram of an existing tree, which was mostly based on intuition
and previous experience with Civ V DLL AI.
