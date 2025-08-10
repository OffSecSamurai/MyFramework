export const manualTips = `
# Manual Testing & Logic Bugs Cheat-Sheet

1. **Assume Nothing – Question Everything**
   • Try odd workflows: skip, reorder, replay steps.
2. **Access-Control / IDOR**
   • Change numeric / UUID parameters (id=1 → 2).
   • Horizontal vs vertical privilege escalation.
3. **Workflow Manipulation**
   • Complete step 1, jump to 3.  Parallel tabs.
4. **Race Conditions**
   • Send duplicate purchase requests simultaneously.
5. **Parameter Tampering**
   • price=100 → 0.01, is_admin=false → true.
6. **API Specific**
   • Try older versions /api/v1/.
   • Change Content-Type to XML/Plain.
7. **Chaining Vulns**
   • XSS → steal cookie → account takeover.

> “What if… I’m not who the app thinks I am?”

Use these heuristics during the Manual Analysis phase to uncover high-impact issues that automation misses.`