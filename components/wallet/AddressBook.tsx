"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWalletStore } from "@/store";

export function AddressBook({ onClose }: { onClose?: () => void }) {
  const { addressBook, addAddressBookEntry, updateAddressBookEntry, removeAddressBookEntry } = useWalletStore();
  const [addr, setAddr] = useState("");
  const [label, setLabel] = useState("");

  const add = () => {
    if (!addr) return;
    // basic stellar address validation: starts with G and length 56
    if (!/^G[A-Z2-7]{55}$/i.test(addr)) {
      alert("Invalid Stellar address");
      return;
    }
    addAddressBookEntry(addr, label);
    setAddr("");
    setLabel("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Address Book</h3>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => onClose?.()}>Close</Button>
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          {addressBook.length === 0 && <p className="text-sm text-muted-foreground">No saved addresses</p>}
          {addressBook.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 rounded-md border p-2">
              <div>
                <div className="font-medium">{e.label || e.address}</div>
                <div className="text-xs text-muted-foreground">{e.address}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => {
                  const newLabel = prompt("Label:", e.label || "") || "";
                  updateAddressBookEntry(e.id, { label: newLabel });
                }}>Edit</Button>
                <Button size="sm" variant="destructive" onClick={() => removeAddressBookEntry(e.id)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-2">
          <Input placeholder="Stellar address (G...)" value={addr} onChange={(e) => setAddr(e.target.value)} />
          <Input placeholder="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <div className="flex justify-end">
            <Button onClick={add}>Add to Address Book</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
