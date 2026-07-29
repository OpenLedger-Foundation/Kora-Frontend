import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { RiskScoreGauge } from "./RiskScoreGauge";

const props = {
  score: 52,
  tier: "BBB",
  factors: [{ key: "history", label: "Payment history", score: 52 }],
  trend: [40, 44, 48, 50, 52],
};

describe("RiskScoreGauge", () => {
  it("renders a separate accessible legend for all risk bands", () => {
    render(<RiskScoreGauge {...props} />);
    const legend = screen.getByTestId("risk-band-legend");
    expect(legend).toHaveTextContent("Low Risk");
    expect(legend).toHaveTextContent("0–33");
    expect(legend).toHaveTextContent("Medium Risk");
    expect(legend).toHaveTextContent("34–66");
    expect(legend).toHaveTextContent("High Risk");
    expect(legend).toHaveTextContent("67–100");
  });

  it("explains a risk band on keyboard-accessible click", async () => {
    render(<RiskScoreGauge {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /Low Risk/i }));
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Strong repayment history",
    );
  });
});
