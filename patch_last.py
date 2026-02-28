import re

with open('fakoshop.html', 'r') as f:
    content = f.read()

# Make sure hidden class correctly applies
# Looking at utility classes:
# .hidden { display: none !important; }
print("Utility class: ", re.search(r'\.hidden\s*\{.*\}', content))

# Let's check captureAdjustmentSource layer.visible
# Layer is added and visible by default.
