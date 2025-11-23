import plotly.graph_objects as go
import pandas as pd
import numpy as np
from neo4j import GraphDatabase
from datetime import datetime

# ── CONFIGURATION ─────────────────────────────────────────────────────
URI = "bolt://localhost:7687"          # change if your DB is remote
USERNAME = "neo4j"
PASSWORD = "your_password_here"

# Change these property names if yours are different
PROP_STATE = "lifecycleState"      # e.g. "Active", "Obsolete", "In Design"...
PROP_TYPE  = "partType"            # e.g. "Assembly", "Component", "Raw Material"...
PROP_DATE  = "createdDate"         # datetime property (Neo4j DateTime or string ISO)

# Optional: restrict to a specific label (recommended if you have many unrelated nodes)
NODE_LABEL = None                  # e.g. "Part" → set to "Part", otherwise None = all nodes

# Optional jitter (helps when many nodes have the same state+type)
JITTER = 0.15                      # set to 0.0 for exact grid positions
# ───────────────────────────────────────────────────────────────────────

driver = GraphDatabase.driver(URI, auth=(USERNAME, PASSWORD))

def fetch_data():
    with driver.session() as session:
        # Build the MATCH clause
        label_clause = f":`{NODE_LABEL}`" if NODE_LABEL else ""
        where_clause = f"exists(n.`{PROP_STATE}`) AND exists(n.`{PROP_TYPE}`) AND exists(n.`{PROP_DATE}`)"

        node_query = f"""
        MATCH (n{label_clause})
        WHERE {where_clause}
        RETURN 
          id(n) AS node_id,
          n.`{PROP_STATE}` AS state,
          n.`{PROP_TYPE}` AS ptype,
          n.`{PROP_DATE}` AS created,
          labels(n) AS labels
        """
        nodes_result = session.run(node_query)

        nodes = []
        for rec in nodes_result:
            nodes.append({
                "id": rec["node_id"],
                "state": rec["state"],
                "ptype": rec["ptype"],
                "created": rec["created"],
                "labels": rec["labels"]
            })

        # Edges (only between nodes that have the required properties)
        edge_query = f"""
        MATCH (a{label_clause})-[r]->(b{label_clause})
        WHERE {where_clause} AND exists(b.`{PROP_STATE}`)
        RETURN id(a) AS source, id(b) AS target
        """
        edges_result = session.run(edge_query)
        edges = [(rec["source"], rec["target"]) for rec in edges_result]

        return nodes, edges

nodes_data, edges = fetch_data()
driver.close()

if len(nodes_data) == 0:
    raise ValueError("No nodes found with the specified properties. Check property names / label.")

df = pd.DataFrame(nodes_data)

# ── Map categorical properties to numeric coordinates ─────────────────
state_order = sorted(df['state'].unique())
state_map = {val: idx for idx, val in enumerate(state_order)}
df['x'] = df['state'].map(state_map)

type_order = sorted(df['ptype'].unique())
type_map = {val: idx for idx, val in enumerate(type_order)}
df['y'] = df['ptype'].map(type_map)

# ── Convert created date to numeric (timestamp) ───────────────────────
def to_timestamp(val):
    if isinstance(val, datetime):
        return val.timestamp()
    elif hasattr(val, 'to_native'):           # Neo4j DateTime object
        return val.to_native().timestamp()
    elif isinstance(val, str):
        return datetime.fromisoformat(val.replace("Z", "+00:00")).timestamp()
    else:
        return 0

df['z'] = df['created'].apply(to_timestamp)

# Optional jitter so nodes with identical state+type don't completely overlap
if JITTER > 0:
    df['x'] += np.random.normal(0, JITTER, size=len(df))
    df['y'] += np.random.normal(0, JITTER, size=len(df))

# ── Build Plotly figure ───────────────────────────────────────────────
fig = go.Figure()

# Edges (gray thin lines)
edge_x, edge_y, edge_z = [], [], []
for src_id, tgt_id in edges:
    src = df[df['id'] == src_id].iloc[0]
    tgt = df[df['id'] == tgt_id].iloc[0]
    edge_x += [src['x'], tgt['x'], None]
    edge_y += [src['y'], tgt['y'], None]
    edge_z += [src['z'], tgt['z'], None]

fig.add_trace(go.Scatter3d(
    x=edge_x, y=edge_y, z=edge_z=edge_z,
    mode='lines',
    line=dict(color='rgb(180,180,180)', width=1),
    hoverinfo='none',
    name='Relationships'
))

# Nodes
fig.add_trace(go.Scatter3d(
    x=df['x'],
    y=df['y'],
    z=df['z'],
    mode='markers',
    marker=dict(
        size=6,
        color=df['x'],                # color by lifecycle state (you can change)
        colorscale='Portland',
        opacity=0.9,
        line=dict(width=1, color='white')
    ),
    text=[f"{row['state']}<br>{row['ptype']}<br>{row['created']}" for _, row in df.iterrows()],
    hoverinfo='text',
    name='Nodes'
))

# Axis layout with proper labels
fig.update_layout(
    title="Neo4j → 3D Graph (X=Lifecycle State, Y=Part Type, Z=Created Date)",
    showlegend=False,
    scene=dict(
        xaxis=dict(
            title="Lifecycle State",
            tickmode='array',
            tickvals=list(state_map.values()),
            ticktext=list(state_map.keys()),
            backgroundcolor="rgb(230, 230, 250)",
        ),
        yaxis=dict(
            title="Part Type",
            tickmode='array',
            tickvals=list(type_map.values()),
            ticktext=list(type_map.keys()),
            backgroundcolor="rgb(230, 250, 230)",
        ),
        zaxis=dict(
            title="Created Date",
            type='linear'
        ),
        aspectmode='manual',
        aspectratio=dict(x=1, y=1, z=1.5),  # stretch Z a bit if dates span many years
        camera=dict(eye=dict(x=1.5, y=1.5, z=1.5))
    ),
    width=1200,
    height=900
)

fig.show()