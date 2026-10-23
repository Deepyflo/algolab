"""Estimateur heuristique de complexité à partir de la syntaxe Python."""
import ast
import json
import re


class ComplexityVisitor:
    LOOP_NODES = (ast.For, ast.AsyncFor, ast.While, ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp)
    LINEAR_CALLS = {"sum", "min", "max", "any", "all", "set", "list", "dict"}

    def __init__(self, function_name):
        self.function_name = function_name
        self.max_loop_depth = 0
        self.has_sort = False
        self.has_linear_call = False
        self.is_recursive = False
        self.has_membership = False

    def walk(self, node, depth=0):
        if isinstance(node, self.LOOP_NODES):
            depth += 1
            self.max_loop_depth = max(self.max_loop_depth, depth)
        if isinstance(node, ast.Call):
            name = node.func.id if isinstance(node.func, ast.Name) else None
            attribute = node.func.attr if isinstance(node.func, ast.Attribute) else None
            if name == self.function_name:
                self.is_recursive = True
            if name == "sorted" or attribute == "sort":
                self.has_sort = True
            if name in self.LINEAR_CALLS:
                self.has_linear_call = True
        if isinstance(node, ast.Compare) and any(isinstance(op, (ast.In, ast.NotIn)) for op in node.ops):
            self.has_membership = True
        for child in ast.iter_child_nodes(node):
            self.walk(child, depth)


def analyze_complexity(code):
    parse_failed = False
    try:
        tree = ast.parse(code)
    except SyntaxError:
        tree = None
        parse_failed = True

    functions = [node for node in ast.walk(tree) if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))] if tree else []
    target = functions[0] if functions else tree
    visitor = ComplexityVisitor(target.name if functions else None)
    if target:
        visitor.walk(target)
    elif re.search(r"\b(for|while)\b", code):
        visitor.max_loop_depth = max(1, len(re.findall(r"\b(for|while)\b", code)))
    if parse_failed and re.search(r"\b(sorted)\s*\(|\.sort\s*\(", code):
        visitor.has_sort = True
    if parse_failed and re.search(r"\b(sum|min|max|any|all)\s*\(", code):
        visitor.has_linear_call = True

    depth = visitor.max_loop_depth
    if visitor.is_recursive:
        order = "Récursivité détectée"
        confidence = "Faible"
        explanation = "L’appel récursif est repéré, mais son coût dépend du nombre d’appels et d’une éventuelle mémoïsation."
    elif depth >= 2:
        order = f"O(n^{depth})"
        confidence = "Moyenne"
        explanation = f"L’analyse repère jusqu’à {depth} niveaux de boucles ou de compréhensions imbriqués."
    elif visitor.has_sort:
        order = "O(n log n)"
        confidence = "Moyenne"
        explanation = "Un tri Python (`sorted` ou `.sort()`) est repéré."
    elif depth == 1 or visitor.has_linear_call:
        order = "O(n)"
        confidence = "Moyenne"
        explanation = "Une boucle ou une opération parcourant une collection est repérée."
    else:
        order = "O(1) apparente"
        confidence = "Faible"
        explanation = "Aucune boucle ni opération de parcours connue n’a été repérée dans la fonction."

    if visitor.has_membership and depth:
        explanation += " Une recherche `in` dans une liste peut ajouter un facteur linéaire ; le type de la collection n’est pas déduit."
    explanation += " Estimation syntaxique indicative, pas une preuve de complexité."
    return json.dumps({"order": order, "confidence": confidence, "explanation": explanation}, ensure_ascii=False)
