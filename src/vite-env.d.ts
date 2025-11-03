/// <reference types="vite/client" />

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

// Declaraciones para Contacts Picker API
interface ContactsManager {
  select(properties: string[], options?: { multiple?: boolean }): Promise<Contact[]>;
}

interface Contact {
  name?: string[];
  tel?: string[];
  email?: string[];
  address?: any[];
}

interface Navigator {
  contacts?: ContactsManager;
}

interface Window {
  ContactsManager?: any;
}










