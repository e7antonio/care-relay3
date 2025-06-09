find . -type f -name "*.md" -print0 | while IFS= read -r -d '' file; do
  echo "# $file" >> combinado.md
  cat "$file" >> combinado.md
  echo -e "\n" >> combinado.md
done
