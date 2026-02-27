from playwright.sync_api import sync_playwright
import os

def verify_features():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Open the index.html file
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        # Wait for the toolbar to be visible
        try:
            page.wait_for_selector("#toolbar")
        except:
             print("FAILED: Toolbar not visible")
             return

        # Test 1: Verify new brushes and shapes buttons exist
        # We check a sample of new tools
        new_tools = [
            "roundrect", "triangle", "rtriangle", "diamond",
            "pentagon", "hexagon", "star", "arrow", "heart", "bubble",
            "poly-lasso"
        ]

        print("--- Verifying Tool Buttons ---")
        for tool in new_tools:
            # We can select by title or onclick attribute
            # Let's try to find an element with onclick containing the tool name
            # XPath: //*[@onclick="setTool('toolname')"]
            try:
                locator = page.locator(f".tool[onclick*=\"'{tool}'\"]")
                if locator.count() > 0:
                    print(f"PASSED: Tool button for {tool} found")
                else:
                    print(f"FAILED: Tool button for {tool} not found")
            except Exception as e:
                print(f"ERROR checking {tool}: {e}")

        # Test 2: Verify Brush Type Dropdown logic
        print("\n--- Verifying Brush Options ---")
        # Click brush tool
        page.locator(".tool[onclick*=\"'brush'\"]").first.click()

        brush_type = page.locator("#brush-type")
        if brush_type.is_visible():
            print("PASSED: Brush type selector visible when brush tool selected")

            # Check options
            expected_options = ["round", "pencil", "square", "airbrush", "calligraphy", "marker", "spray"]
            # Get all option values
            options_text = brush_type.inner_text()
            for opt in expected_options:
                # This is a loose check, better to check values
                if opt in options_text.lower():
                     print(f"PASSED: Option '{opt}' found")
                else:
                     print(f"FAILED: Option '{opt}' missing")
        else:
            print("FAILED: Brush type selector NOT visible")

        # Test 3: Verify Shape Style Dropdown logic
        print("\n--- Verifying Shape Options ---")
        # Click rect tool
        page.locator(".tool[onclick*=\"'rect'\"]").first.click()

        shape_style = page.locator("#shape-style")
        if shape_style.is_visible():
            print("PASSED: Shape style selector visible when shape tool selected")
        else:
            print("FAILED: Shape style selector NOT visible")

        # Test 4: Flip Menu Items
        print("\n--- Verifying Menu Items ---")
        # Click Edit menu to open dropdown
        page.locator(".menu-item", has_text="Edit").click()

        flip_h = page.locator("text=Flip Horizontal")
        flip_v = page.locator("text=Flip Vertical")

        if flip_h.is_visible():
             print("PASSED: Flip Horizontal menu item visible")
        else:
             print("FAILED: Flip Horizontal menu item NOT visible")

        if flip_v.is_visible():
             print("PASSED: Flip Vertical menu item visible")
        else:
             print("FAILED: Flip Vertical menu item NOT visible")

        # Take Screenshot
        page.screenshot(path="verification/verification.png")
        print("\nScreenshot saved to verification/verification.png")

        browser.close()

if __name__ == "__main__":
    verify_features()
