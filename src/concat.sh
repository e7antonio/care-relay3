#!/bin/bash

# 1. Mostrar la estructura del árbol de carpetas
echo "Estructura de la carpeta:"
tree -a

echo ""
echo "---------------------"
echo ""

# 2. Recorrer y concatenar archivos markdown
find . -type f -name "*.ts" | sort | while read -r file; do
  echo "---"
  echo "$file"
  echo ""
  cat "$file"
  echo ""
done
