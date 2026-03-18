export type Category = {
  id: string;
  name: string;
  parentId: string | null;
  itemCount: number;
};

export type TreeNode = Category & { children: TreeNode[] };

export function buildTree(cats: Category[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const c of cats) {
    map.set(c.id, { ...c, children: [] });
  }
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  for (const node of map.values()) {
    node.children.sort((a, b) => a.name.localeCompare(b.name));
  }
  return roots.sort((a, b) => a.name.localeCompare(b.name));
}
