import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BackupControls } from "./BackupControls";

const text = '[{"id":"p","name":"ورشة محفوظة","workers":[],"weeks":[]}]';
beforeEach(() => localStorage.clear());
afterEach(cleanup);
function setup() {
  const restore = vi.fn();
  render(<BackupControls projects={[]} ready restore={restore} />);
  return restore;
}
function upload(contents = text) {
  fireEvent.change(screen.getByLabelText("ملف النسخة الاحتياطية"), {
    target: { files: [{ name: "backup.json", text: async () => contents }] },
  });
}
describe("restore consent", () => {
  it("only restores after preview and explicit confirmation", async () => {
    const restore = setup(); upload();
    await screen.findByRole("dialog");
    expect(restore).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "تأكيد استبدال البيانات" }));
    expect(restore).toHaveBeenCalledExactlyOnceWith(text);
  });
  it("cancels without invoking restoration", async () => {
    const restore = setup(); upload();
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "إلغاء" }));
    expect(restore).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("never offers confirmation for an invalid file", async () => {
    const restore = setup(); upload("{}");
    await screen.findByRole("alert");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(restore).not.toHaveBeenCalled();
  });
  it("blocks stale previews when local data changes", async () => {
    const restore = setup(); upload();
    await screen.findByRole("dialog");
    localStorage.setItem("a3mali-v1", "[]");
    fireEvent.click(screen.getByRole("button", { name: "تأكيد استبدال البيانات" }));
    await screen.findByRole("alert");
    expect(restore).not.toHaveBeenCalled();
  });
  it("keeps the preview open on a failed save", async () => {
    const restore = setup(); restore.mockImplementation(() => { throw new Error("full"); }); upload();
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "تأكيد استبدال البيانات" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
  it("allows reselecting the same file after cancellation", async () => {
    const restore = setup(); upload();
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "إلغاء" })); upload();
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    expect(restore).not.toHaveBeenCalled();
  });
});