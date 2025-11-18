import RegistrationForm from "../RegistrationForm";

export default function RegistrationFormExample() {
  return (
    <RegistrationForm
      onSuccess={(data) => console.log("Registration successful:", data)}
    />
  );
}
