// Testa o filtro dos avisos do Firestore (js/gate.js) com relógio simulado.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createGate } from "../js/gate.js";

describe("createGate", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const make = (generation = { value: 0 }) => {
    const apply = vi.fn();
    const gate = createGate(apply, () => generation.value, { wait: 150, now: () => Date.now() });
    return { apply, gate, generation };
  };

  it("o primeiro aviso passa na hora", () => {
    const { apply, gate } = make();
    gate([{ id: "a" }], undefined, { fromCache: true });
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("ignora dados iguais ao último aviso", () => {
    const { apply, gate } = make();
    gate([{ id: "a", v: 1 }], undefined, { fromCache: false });
    vi.advanceTimersByTime(500);
    gate([{ id: "a", v: 1 }], undefined, { fromCache: false });
    vi.advanceTimersByTime(500);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("o mesmo dado confirmado pelo servidor ainda é aviso novo (cache -> servidor)", () => {
    const { apply, gate } = make();
    gate([{ id: "a" }], undefined, { fromCache: true });
    vi.advanceTimersByTime(500);
    gate([{ id: "a" }], undefined, { fromCache: false });
    expect(apply).toHaveBeenCalledTimes(2);
    expect(apply.mock.calls[1][2]).toEqual({ fromCache: false });
  });

  it("junta uma rajada (uma gravação por ativo) num redesenho só, com o dado mais novo", () => {
    const { apply, gate } = make();
    gate([{ id: "a", price: 1 }], undefined, {});
    expect(apply).toHaveBeenCalledTimes(1);
    for (let price = 2; price <= 30; price++) {
      vi.advanceTimersByTime(5);
      gate([{ id: "a", price }], undefined, {});
    }
    expect(apply).toHaveBeenCalledTimes(1); // ainda segurando
    vi.advanceTimersByTime(200);
    expect(apply).toHaveBeenCalledTimes(2);
    expect(apply.mock.calls[1][0]).toEqual([{ id: "a", price: 30 }]);
  });

  it("depois de um tempo parado, o próximo aviso passa direto", () => {
    const { apply, gate } = make();
    gate([1], undefined, {});
    vi.advanceTimersByTime(1000);
    gate([2], undefined, {});
    expect(apply).toHaveBeenCalledTimes(2);
  });

  it("erros passam sempre, sem espera", () => {
    const { apply, gate } = make();
    gate([1], undefined, {});
    gate([], new Error("falhou"), undefined);
    gate([], new Error("falhou"), undefined);
    expect(apply).toHaveBeenCalledTimes(3);
  });

  it("descarta o que estava à espera quando a assinatura muda (troca de modo / logout)", () => {
    const { apply, gate, generation } = make();
    gate([1], undefined, {});
    gate([2], undefined, {}); // agendado
    generation.value++; // trocou de modo
    vi.advanceTimersByTime(500);
    expect(apply).toHaveBeenCalledTimes(1);
    gate([3], undefined, {}); // aviso tardio da assinatura antiga
    vi.advanceTimersByTime(500);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("flush aplica já o que está à espera", () => {
    const { apply, gate } = make();
    gate([1], undefined, {});
    gate([2], undefined, {});
    gate.flush();
    expect(apply).toHaveBeenCalledTimes(2);
    expect(apply.mock.calls[1][0]).toEqual([2]);
    vi.advanceTimersByTime(500);
    expect(apply).toHaveBeenCalledTimes(2);
  });
});
