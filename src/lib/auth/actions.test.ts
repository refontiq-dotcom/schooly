import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
    },
    rpc: rpcMock,
    from: fromMock,
  })),
}));

import { createEstablishment } from "./actions";

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("createEstablishment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpcMock.mockResolvedValue({ error: null });
  });

  it("crée l'établissement et redirige, même si publish_to_trouvetou est coché", async () => {
    await expect(
      createEstablishment(
        null,
        formData({
          name: "Lycée Test",
          city: "Abidjan",
          school_type: "lycee",
          publish_to_trouvetou: "on",
        })
      )
    ).rejects.toThrow("REDIRECT:/dashboard/admin");

    expect(rpcMock).toHaveBeenCalledWith(
      "create_establishment_as_admin",
      expect.objectContaining({
        p_name: "Lycée Test",
        p_school_type: "lycee",
      })
    );
  });

  it("n'effectue aucune écriture de publication Trouvetou", async () => {
    await expect(
      createEstablishment(
        null,
        formData({
          name: "Collège Test",
          city: "Bouaké",
          school_type: "college",
          publish_to_trouvetou: "on",
        })
      )
    ).rejects.toThrow("REDIRECT:/dashboard/admin");

    expect(fromMock).not.toHaveBeenCalled();
  });

  it("valide les champs requis", async () => {
    const error = await createEstablishment(null, formData({ name: "", city: "" }));
    expect(error).toMatch(/nom et la ville/i);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
